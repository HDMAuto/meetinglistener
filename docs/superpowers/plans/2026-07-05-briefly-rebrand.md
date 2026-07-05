# Briefly Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename MeetingListener to Briefly everywhere users can see, with the new blue mark, blue UI palette, "Meetings, briefly." tagline, and 0.2.0 versions.

**Architecture:** A master vector mark (`docs/brand/briefly-mark.svg`) feeds the favicon, sidebar LogoMark, desktop icon, and mobile icon (rendered via `qlmanage`). The Tailwind `brand` scale swaps teal→blue in one place. Naming changes touch frontend copy, desktop/mobile config (product names + mic-permission strings), and the backend download page (which gets a CSS dark hero echoing the logo render — no binary asset plumbing). Spec: `docs/superpowers/specs/2026-07-05-briefly-rebrand-design.md`.

**Tech Stack:** SVG authoring, macOS `qlmanage`/`sips` for PNG rendering, Tailwind tokens, electron-builder config, Expo app.json, the server-rendered download page template.

## Global Constraints

- Name is exactly **Briefly**; tagline exactly **"Meetings, briefly."**
- NOT renamed (verbatim from spec): GitHub repo, `meetings-api.hdmauto.app`, server paths/launchd/tunnel/DB, npm package names (`meetinglistener-*`), Electron `appId` (`app.meetinglistener.desktop`), Expo `slug`/bundle identifiers. Internal code identifiers and comments are out of scope.
- New `brand` palette (exact values): 50 `#EFF6FF`, 100 `#DBEAFE`, 200 `#BFDBFE`, 300 `#93C5FD`, 500 `#3B82F6`, 600 `#2563EB`, 700 `#1D4ED8`, 800 `#1E40AF`, 900 `#1E3A8A`. `accent` (orange), `ink`, `muted` unchanged.
- Versions → `0.2.0` in backend/frontend/desktop/mobile package.json (and mobile app.json `version`).
- LOCAL ONLY: no push, no deploy, no installer uploads — rollout is a separate later step.
- Commits from repo root; messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Baseline: 103/103 backend tests green; both typechecks clean.

---

### Task 1: Brand assets — master mark + derived icons

**Files:**
- Create: `docs/brand/briefly-mark.svg` (master, transparent background)
- Create: `docs/brand/briefly-tile.svg` (navy rounded-square tile for app icons)
- Replace: `frontend/public/favicon.svg`, `desktop/build/icon.svg` (copies of the mark)
- Replace: `desktop/build/icon.png`, `mobile/assets/icon.png` (rendered from the tile)

**Interfaces:**
- Produces: the mark's inner SVG (gradient `briefly-g` + 4 paths/3 rects) that Task 2's LogoMark and Task 4's download page inline verbatim.

- [ ] **Step 1: Author the master mark**

Create `docs/brand/briefly-mark.svg`:

```svg
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="briefly-g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#1D4ED8"/>
      <stop offset="0.55" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <!-- Speech bubble with a folded document corner (top right) -->
  <path fill="url(#briefly-g)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z"/>
  <!-- Folded corner -->
  <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z"/>
  <!-- Summary lines -->
  <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF"/>
  <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE"/>
  <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE"/>
  <!-- Sparkle -->
  <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z"/>
</svg>
```

- [ ] **Step 2: Author the icon tile**

Create `docs/brand/briefly-tile.svg` — same mark centered on a navy rounded square with safe-area padding (mark scaled 0.72, centered):

```svg
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="briefly-g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#1D4ED8"/>
      <stop offset="0.55" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#38BDF8"/>
    </linearGradient>
    <linearGradient id="briefly-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F1E47"/>
      <stop offset="1" stop-color="#1E3A8A"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#briefly-bg)"/>
  <g transform="translate(71.68 71.68) scale(0.72)">
    <path fill="url(#briefly-g)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z"/>
    <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z"/>
    <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF"/>
    <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE"/>
    <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE"/>
    <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z"/>
  </g>
</svg>
```

- [ ] **Step 3: Render a visual proof and eyeball it**

Run:
```bash
mkdir -p /tmp/briefly-icons
qlmanage -t -s 512 -o /tmp/briefly-icons docs/brand/briefly-mark.svg docs/brand/briefly-tile.svg
```
Expected: two PNGs produced. Open both with the Read tool (they render as images) and CHECK: bubble shape reads as a speech bubble with folded corner, three lines legible, sparkle clear of the fold, tile has comfortable padding. If the geometry looks off, adjust the SVG paths and re-render until right — this step gates the rest.

- [ ] **Step 4: Derive the app assets**

```bash
cp docs/brand/briefly-mark.svg frontend/public/favicon.svg
cp docs/brand/briefly-mark.svg desktop/build/icon.svg
qlmanage -t -s 1024 -o /tmp/briefly-icons docs/brand/briefly-tile.svg
cp /tmp/briefly-icons/briefly-tile.svg.png desktop/build/icon.png
sips -z 1024 1024 /tmp/briefly-icons/briefly-tile.svg.png --out mobile/assets/icon.png
```
Expected: `file desktop/build/icon.png` reports 1024x1024 PNG; same for mobile.

- [ ] **Step 5: Commit**

```bash
git add docs/brand frontend/public/favicon.svg desktop/build/icon.svg desktop/build/icon.png mobile/assets/icon.png
git commit -m "feat(brand): Briefly mark and derived icons (favicon, desktop, mobile)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend rebrand — tokens, title, LogoMark, Login, version

**Files:**
- Modify: `frontend/tailwind.config.js` (brand scale), `frontend/index.html` (title), `frontend/src/components/AppLayout.tsx` (LogoMark), `frontend/src/pages/Login.tsx` (brand panel), `frontend/package.json` (version)

**Interfaces:**
- Consumes: mark SVG from Task 1 (inlined as JSX).
- Produces: blue `brand-*` tokens every component already consumes.

- [ ] **Step 1: Swap the brand scale in `frontend/tailwind.config.js`**

Replace the `brand` object only (accent/ink/muted untouched):

```js
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
```

- [ ] **Step 2: `frontend/index.html`** — `<title>MeetingListener</title>` → `<title>Briefly</title>`

- [ ] **Step 3: Replace `LogoMark` in `frontend/src/components/AppLayout.tsx`**

```tsx
function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg className="h-9 w-9" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="briefly-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#1D4ED8" />
            <stop offset="0.55" stopColor="#2563EB" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <path fill="url(#briefly-g)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z" />
        <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z" />
        <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF" />
        <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE" />
        <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE" />
        <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight text-brand-900">Briefly</div>
        <div className="text-[11px] font-medium text-muted">Meetings, briefly.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Login brand panel in `frontend/src/pages/Login.tsx`**

- Panel class: `bg-brand-700` → `bg-brand-900`.
- Inline glow style becomes blue-only:
```tsx
          style={{
            background:
              "radial-gradient(60rem 60rem at 20% 10%, rgba(56,189,248,0.5), transparent), radial-gradient(40rem 40rem at 90% 90%, rgba(37,99,235,0.45), transparent)",
          }}
```
- The small waveform icon block inside the white/15 rounded tile: replace the `<svg>` with the same mark SVG as LogoMark (className `h-6 w-6`, but use gradient id `briefly-g-login` in BOTH the def and the fill url to avoid duplicate-id collisions when both panels ever co-render).
- `<span className="text-lg font-extrabold tracking-tight">MeetingListener</span>` → `Briefly`.
- Headline/copy stay; the footer line `Transcribe · Summarize · Assign · Notify` stays.

- [ ] **Step 5: `frontend/package.json` version** → `"version": "0.2.0"` (add the field after `"private": true` if absent).

- [ ] **Step 6: Verify + commit**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: clean.

```bash
git add frontend
git commit -m "feat(frontend): Briefly branding — blue palette, new mark, tagline, 0.2.0

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Desktop + mobile naming/config

**Files:**
- Modify: `desktop/package.json` (productName, version, mic-permission text), `desktop/src/main.ts` (window title), `mobile/app.json` (name, version, mic-permission text), `mobile/package.json` (version), `mobile/src/screens/LoginScreen.tsx` (accessibilityLabel), `backend/package.json` (version)

**Interfaces:** none downstream; pure config/copy.

- [ ] **Step 1: `desktop/package.json`**

- `"version": "0.1.0"` → `"0.2.0"`
- `"productName": "MeetingListener"` → `"Briefly"`
- `NSMicrophoneUsageDescription` → `"Briefly records meeting audio so it can transcribe and summarize your meetings."`
- `appId` and `"name"` UNCHANGED.

- [ ] **Step 2: `desktop/src/main.ts`** — `title: "MeetingListener"` → `title: "Briefly"`.

- [ ] **Step 3: `mobile/app.json`**

- `"name": "MeetingListener"` → `"Briefly"`; `"version": "0.1.0"` → `"0.2.0"`
- `microphonePermission` → `"Briefly records meeting audio so it can transcribe and summarize your meetings."`
- `slug`, `bundleIdentifier`, `package` UNCHANGED.

- [ ] **Step 4:** `mobile/package.json` + `backend/package.json` versions → `"0.2.0"`. In `mobile/src/screens/LoginScreen.tsx`, `accessibilityLabel="MeetingListener logo"` → `"Briefly logo"`.

- [ ] **Step 5: Verify + commit**

Run: `cd mobile && npx tsc --noEmit` (mobile typecheck) and `cd desktop && npm run build:main`
Expected: both clean. (Full desktop smoke happens in Task 5.)

```bash
git add desktop mobile backend/package.json
git commit -m "feat: Briefly product naming for desktop and mobile; 0.2.0 versions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Download page rebrand

**Files:**
- Modify: `backend/src/downloads/download.routes.ts` (the `page()` template only — route logic untouched)

**Interfaces:** consumes the mark SVG from Task 1 (inlined).

- [ ] **Step 1: Rebrand the template**

In `page()`:
- `<title>Download MeetingListener</title>` → `<title>Download Briefly</title>`
- Replace the old headphones `<svg class="logo">…</svg>` block with the Briefly mark (same inner SVG as Task 1's mark, `class="logo"` kept; keep gradient id `briefly-g`).
- `<span class="title">Meeting<span class="l">Listener</span></span>` → `<span class="title">Briefly</span>` and delete the now-unused `.title .l` CSS rule.
- Copy: `<h1>Download the app</h1>` stays; `.sub` → `Install Briefly on your Mac or Windows PC.`
- Teal CSS values → blue: `.os` color and `.btn` background `#0D9488` → `#2563EB`.
- **Dark hero**: wrap the existing `.brand` block in a hero band recreating the logo render in CSS. Replace the `.brand` markup/styling with:

```html
    <div class="hero">
      <div class="brand">
        <svg class="logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="briefly-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#1D4ED8"/><stop offset="0.55" stop-color="#2563EB"/><stop offset="1" stop-color="#38BDF8"/></linearGradient></defs>
          <path fill="url(#briefly-g)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z"/>
          <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z"/>
          <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF"/>
          <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE"/>
          <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE"/>
          <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z"/>
        </svg>
        <span class="title">Briefly</span>
      </div>
      <p class="tag">Meetings, briefly.</p>
    </div>
```

and add/replace CSS:

```css
  .hero { background:#0B1533; border-radius:20px; padding:28px 24px; margin-bottom:28px;
          background-image:radial-gradient(24rem 16rem at 25% 20%, rgba(56,189,248,.35), transparent),
                           radial-gradient(30rem 20rem at 80% 90%, rgba(37,99,235,.3), transparent); }
  .brand { display:flex; align-items:center; gap:12px; }
  .logo { width:44px; height:44px; }
  .title { font-weight:800; font-size:22px; letter-spacing:-0.02em; color:#fff; }
  .tag { color:#93C5FD; font-size:14px; margin:10px 0 0; }
```

- Footer line stays (`Internal build · connects to meetings-api.hdmauto.app`).

- [ ] **Step 2: Verify + commit**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 103/103 (no test asserts branding — verified during planning), tsc clean.

```bash
git add backend/src/downloads/download.routes.ts
git commit -m "feat(backend): Briefly-branded download page with dark hero

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Sweep check + full verification

**Files:** none new — verification; fix any stragglers found.

- [ ] **Step 1: Completeness grep**

Run: `grep -rn "MeetingListener" frontend/src frontend/index.html desktop/src desktop/package.json mobile/app.json mobile/src backend/src/downloads`
Expected: ZERO hits except `mobile/src/theme.ts:1` (a code comment — allowed). Anything else user-visible found → fix it in this task and note it.
(Allowed to remain repo-wide: package `name` fields, appId/slug/identifiers, backend server.ts log line, docs/, .superpowers/.)

- [ ] **Step 2: Suites + builds**

Run: `cd backend && npm test && npx tsc --noEmit` → 103/103, clean.
Run: `cd frontend && npx tsc -b && npm run build` → clean.
Run: `cd desktop && npm run smoke` → strict smoke passes (React mounts, 0 console errors, window titled Briefly).

- [ ] **Step 3: Preview verification** (controller performs in main session)

1. Login page: navy/blue panel, "Briefly" wordmark + mark, no teal anywhere.
2. App: sidebar mark + "Briefly" + "Meetings, briefly."; buttons/nav highlights blue; orange accents intact (notification badge); ⌘K palette, status badges render sanely in blue.
3. Tab shows the new favicon and title "Briefly".
4. Download page (local backend): dark hero with mark, blue buttons, correct copy.
5. Screenshot proof of dashboard + login + download page.

- [ ] **Step 4: Commit any sweep fixes**

```bash
git add -A && git commit -m "chore: rebrand sweep stragglers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
(Skip if the sweep found nothing.)

- [ ] **Step 5: Report**

No push/deploy/installer builds — rollout is a separate step the user triggers (deploy download page, rebuild + upload both installers, delete old-named installer files from the server).
