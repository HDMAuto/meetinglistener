# Desktop Update Notice — Design

**Date:** 2026-07-05
**Status:** Approved

## Goal

People who installed the Briefly desktop app learn about new versions inside the app: a dismissible banner appears when the server has a newer installer, linking to the download page. Chosen over full auto-update (needs Apple code-signing) and remote-loaded UI (bigger restructure) — those remain future options; this ships value now with no signing and no new infrastructure.

Decisions made during brainstorming:

- **Mechanism (chosen from the 3-option comparison):** version-check banner. Backend derives the latest version from installer filenames in `DOWNLOADS_DIR` — no new state or release step; uploading installers IS the release.
- **Dismissal: per-version.** Dismissing hides the banner for that specific version (localStorage); a newer version reappears. Rejected: session-only (nags every launch), non-dismissable (annoying).
- **Desktop-only:** the banner renders only under the `file:` protocol (the existing Electron detection used for HashRouter). The web dev instance never shows it.
- **Version source:** the renderer's own version is injected at build time from `frontend/package.json`. **Release rule: `frontend` and `desktop` package versions are bumped together** (both 0.2.0 today).

## Backend

`GET /version` — **public, no auth** (exposes only what the public download page already shows).

- Scans `DOWNLOADS_DIR` filenames for `\d+\.\d+\.\d+` patterns (skips dotfiles/blockmaps like the download page does).
- Responds `{ latest: "<highest semver>" }` or `{ latest: null }` when no versioned installers exist.
- Pure helper `latestVersionFrom(names: string[]): string | null` with numeric per-segment comparison (`10.0.0 > 9.9.9`); malformed names skipped.
- Mounted in `app.ts` next to `/health` (no `requireAuth`).

## Frontend

- Vite `define`: `__APP_VERSION__` = frontend package.json version; ambient type declaration added.
- New `UpdateBanner` component mounted in `AppLayout` above the main content area:
  - TanStack Query on `["appVersion"]`, `api.getLatestVersion()`, `refetchInterval` 4 hours, enabled only when `isDesktop` (`window.location.protocol === "file:"`; a dev-only override `localStorage.briefly_force_update_banner = "1"` lets the browser preview exercise it).
  - Shows when `latest` is a strictly newer version than `__APP_VERSION__` (shared `isNewerVersion(a, b)` util, numeric dot-segment compare) AND `latest !== localStorage.briefly_dismissed_version`.
  - Content: mark icon, "Briefly {latest} is available", Download button → opens `https://meetings-api.hdmauto.app/download` via `window.open(..., "_blank")`, ✕ button → stores `briefly_dismissed_version = latest`.
  - Styling: slim brand-50/brand-200 bar consistent with the design system; never overlaps or blocks content; simply absent on error/null/current.

## Desktop

`desktop/src/main.ts`: add `webContents.setWindowOpenHandler` → `shell.openExternal(url)` + `{ action: "deny" }` for `http(s)` URLs, so the Download button (and any future external link) opens the system browser instead of an Electron window.

## Errors & edge cases

- `/version` unreachable, malformed, or `latest: null` → no banner, app unaffected.
- `latest` equal or older than app → no banner.
- Downloads dir missing → endpoint returns `{ latest: null }` (mirrors download page behavior).

## Testing

- Backend: unit tests for `latestVersionFrom` (mixed real filenames `Briefly-0.2.0-universal.dmg` + `Briefly Setup 0.2.0.exe`, multi-version pick-highest incl. `0.10.0 > 0.9.0`, junk/emptiness); route test: 200 shape, no auth required.
- Frontend: `tsc -b` + build; preview verification with the dev override + a stubbed higher `latest` (banner shows, Download link correct, dismiss persists, newer version re-triggers).
- Desktop: `npm run smoke` still passes.

## Rollout

Backend deploy activates `/version` immediately. The banner ships to users inside the NEXT installer generation (first release after this lands) — by design; the feature exists to announce all releases after that.

## Out of scope

- Auto-download/auto-install (electron-updater; revisit with Apple Developer cert)
- Remote-loaded UI
- Mobile update notices (Expo OTA is the eventual answer there)
- Release-notes display
