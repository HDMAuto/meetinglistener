# MeetingListener — Deployment Runbook (self-hosted, macOS server)

Deploys the backend to your company macOS server (`10.0.0.158`), using your existing
PostgreSQL, and exposes it publicly at **`https://meetings-api.hdmauto.app`** via a
Cloudflare Tunnel. All data stays on your server; only transcription (AssemblyAI) and
analysis (Claude) leave, as API calls.

Run every step **on the server** unless noted. Lines starting with `#` are comments.

---

## 0. Prerequisites (on the server)

```bash
# Node 20+ (check; install via Homebrew if missing)
node -v            # need v20 or newer
# brew install node@22   # if needed, then add to PATH

# PostgreSQL running and reachable
psql --version
pg_isready         # should say "accepting connections"

# Homebrew (for cloudflared later)
brew --version

# Note the absolute node path — you'll need it for the service file:
which node         # e.g. /opt/homebrew/bin/node
```

---

## 1. Get the code onto the server

```bash
cd ~
git clone <YOUR_REPO_URL> MeetingListener      # or copy the repo over
cd MeetingListener/backend
npm ci                                          # install exact dependencies
```

> No repo URL yet? You can `rsync -av --exclude node_modules --exclude dist \
> ./MeetingListener/ hdm@10.0.0.158:~/MeetingListener/` from your Mac instead.

---

## 2. Create the database + a dedicated DB user

Using a role that can create databases (often your login user or `postgres`):

```bash
psql -d postgres <<'SQL'
CREATE USER meetinglistener WITH PASSWORD 'CHANGE_ME_DB_PASSWORD';
CREATE DATABASE meetinglistener OWNER meetinglistener;
SQL
```

This creates a **separate** `meetinglistener` database next to your existing ones —
nothing else is touched.

---

## 3. Configure the backend

```bash
cd ~/MeetingListener/backend
cp .env.production.example .env
# Generate a strong secret:
openssl rand -hex 32
# Now edit .env and fill in: DATABASE_URL password, JWT_SECRET (the value above),
# ANTHROPIC_API_KEY, ASSEMBLYAI_API_KEY. Keep NODE_ENV=production.
nano .env
```

Create the schema and build:

```bash
npm run migrate:deploy     # applies the migration to the fresh DB
npm run build              # prisma generate + tsc -> dist/
mkdir -p logs uploads
```

Smoke-test it by hand before making it a service:

```bash
npm start                  # should print "listening on :3000 (production)"
# in another terminal:
curl -s localhost:3000/health     # -> {"status":"ok"}
# Ctrl+C to stop
```

If it refuses to start complaining about `JWT_SECRET` or missing API keys — good, that's
the production guard. Fix `.env` and retry.

---

## 4. Run the backend as a service (launchd)

```bash
cd ~/MeetingListener
# Fill in the placeholders in the plist:
#   __NODE__   = output of `which node`
#   __APPDIR__ = absolute path to the backend, e.g. /Users/hdm/MeetingListener/backend
#   __USER__   = your macOS username (whoami)
nano deploy/com.hdmauto.meetinglistener.plist

sudo cp deploy/com.hdmauto.meetinglistener.plist /Library/LaunchDaemons/
sudo chown root:wheel /Library/LaunchDaemons/com.hdmauto.meetinglistener.plist
sudo launchctl load /Library/LaunchDaemons/com.hdmauto.meetinglistener.plist

# Verify it's running and survives:
curl -s localhost:3000/health          # -> {"status":"ok"}
tail -f backend/logs/backend.err.log   # watch for errors (Ctrl+C to stop tailing)
```

Manage it later:
```bash
sudo launchctl unload /Library/LaunchDaemons/com.hdmauto.meetinglistener.plist   # stop
sudo launchctl load   /Library/LaunchDaemons/com.hdmauto.meetinglistener.plist   # start
```

---

## 5. Expose it with a Cloudflare Tunnel

```bash
brew install cloudflared

cloudflared tunnel login          # opens a browser; pick the hdmauto.app zone
cloudflared tunnel create meetinglistener
# ^ prints a Tunnel UUID and writes ~/.cloudflared/<UUID>.json — note the UUID.

# Config file:
cp ~/MeetingListener/deploy/cloudflared-config.example.yml ~/.cloudflared/config.yml
nano ~/.cloudflared/config.yml     # set __TUNNEL_UUID__ and __USER__

# Point the DNS record at the tunnel:
cloudflared tunnel route dns meetinglistener meetings-api.hdmauto.app

# Run it as a service (installs its own launchd daemon):
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared   # if not auto-started
```

---

## 6. Verify from the outside

From **any** machine (including your Mac, off the office network):

```bash
curl -s https://meetings-api.hdmauto.app/health     # -> {"status":"ok"}
```

If that returns ok, the backend is live and public. 🎉

---

## 7. Point the apps at production & distribute

**Desktop (do this on your dev Mac, not the server):**
```bash
cd ~/MeetingListener/desktop
npm run dist        # builds the DMG; the renderer uses frontend/.env.production
```
Hand out `desktop/release/MeetingListener-0.1.0-arm64.dmg`. It now talks to
`meetings-api.hdmauto.app`, so it works on any staff Mac with no local backend.

**Mobile:** the app already defaults to the production URL. Getting it *onto phones*
(TestFlight / EAS Build / Android APK) is a separate step — see the notes at the end.

---

## 8. Hardening & good practice

- **JWT_SECRET**: must be the strong random value from step 3 (the app refuses weak ones in production).
- **Postgres**: keep it bound to `localhost` on the server; the tunnel only exposes the backend, never the database.
- **Optional — Cloudflare Access**: put an Access policy in front of `meetings-api.hdmauto.app` to require a company login before anyone even reaches the API. Good defense-in-depth for internal-only use.
- **Backups**: add `meetinglistener` to whatever backs up your existing Postgres.

---

## 9. Updating later

```bash
cd ~/MeetingListener && git pull
cd backend && npm ci && npm run migrate:deploy && npm run build
sudo launchctl kickstart -k system/com.hdmauto.meetinglistener   # restart the service
```

---

## Appendix — getting the mobile app onto phones

Installing on real devices isn't a file hand-off like the desktop DMG:

- **iOS**: needs an Apple Developer account ($99/yr). Build with **EAS Build**
  (`eas build -p ios`) and distribute via **TestFlight** (internal testers) or ad-hoc.
- **Android**: build an APK with EAS (`eas build -p android --profile preview`) and
  staff can install it directly (sideload).

We'll tackle this as its own task once the backend is live.
