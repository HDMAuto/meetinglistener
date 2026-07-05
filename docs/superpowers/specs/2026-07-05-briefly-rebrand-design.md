# Briefly Rebrand — Design

**Date:** 2026-07-05
**Status:** Approved

## Goal

Rename the product from **MeetingListener** to **Briefly**, adopt the new logo (blue-gradient speech-bubble/document mark with sparkle; source `logo.png` provided by the user), shift the UI palette from teal to the logo's blues, and update every user-visible surface. Infrastructure and code-internal names stay put.

Decisions made during brainstorming:

- **Rename depth: user-visible only.** App names, wordmarks, icons, product/installer names, download page, mobile display name, page titles. NOT renamed: GitHub repo, `meetings-api.hdmauto.app`, server directory/launchd labels/tunnel, DB names, npm package names, Electron `appId`, Expo slug. Rejected: infra rename (downtime/breakage risk for aesthetics), new API domain (forces client rebuild churn for no user value).
- **Palette: shift brand tokens to the logo's blues; keep the orange accent.** Rejected: keep-teal (logo would clash app-wide), blue-only (loses the warm contrast color for statuses/badges).
- **Tagline:** "Meetings, briefly." (replaces "Meetings, understood") — sidebar, login panel, download page.
- **Icon strategy: vector recreation** of the mark (transparent background, logo's blue gradient) as the master asset — same approach as the previous logo. The provided `logo.png` (dark marketing render) is used ONLY where its dark background works: the download page hero. Rejected: cropping the PNG for icons (dark square favicon, glow halos, mud at 16px).
- **Version bump: 0.1.0 → 0.2.0** in frontend/desktop/mobile/backend package.json files, so installer generations are distinguishable (`Briefly-0.2.0-universal.dmg`, `Briefly Setup 0.2.0.exe`).

## Naming sweep (exact surfaces)

| Surface | Change |
|---|---|
| `frontend/index.html` | `<title>Briefly</title>` |
| Sidebar `LogoMark` (AppLayout.tsx) | New mark SVG + wordmark "Briefly" + tagline "Meetings, briefly." |
| Login page brand panel | "Briefly" wordmark, tagline copy, navy→blue gradient backdrop |
| Desktop `package.json` | `productName: "Briefly"`; window/About name follows; **`appId` UNCHANGED** (`app.meetinglistener.desktop`) so installed apps upgrade in place |
| Desktop artifacts | `Briefly-0.2.0-universal.dmg`, `Briefly Setup 0.2.0.exe` |
| Mobile `app.json` | Display `name: "Briefly"`; slug/bundle identifiers unchanged |
| Download page (backend `src/downloads/`) | Title/headings "Briefly", dark hero section using the provided logo render, installer list reflects new filenames |
| Version fields | `0.2.0` in backend/frontend/desktop/mobile package.json |

Any remaining literal "MeetingListener" in user-visible strings is part of the sweep; code-internal identifiers (package names, service names, comments, docs/) are not.

## Palette

New Tailwind `brand` scale built from the logo (final values tuned during implementation with the design skills; anchors from the logo):

- `brand-500/600` primary: the mark's vivid blue (≈ #2563EB family) — buttons, nav highlights, links, focus rings
- `brand-50/100/200`: pale blue tints for backgrounds/chips
- `brand-700/900`: deep navy (wordmark color) for emphasis and the login gradient
- `accent-*` (orange #F97316 scale): UNCHANGED
- `ink`/`muted`/neutral slate scale: unchanged
- Login brand panel: navy base with a blue radial glow echoing the logo render

Single-source change in `frontend/tailwind.config.*` tokens; components consume tokens so no per-component color edits beyond the LogoMark/login gradient.

## Assets

- **Master mark**: new `docs/brand/briefly-mark.svg` — vector recreation: rounded speech bubble with folded top-right document corner, three text lines, four-point sparkle at the upper right; light-blue→blue gradient; transparent background.
- Derived (same mark, sized/adapted): `frontend/public/favicon.svg`; `desktop/build/icon.*` (whatever format the current build consumes — swap in place, same filenames); inline SVG in `LogoMark`; `mobile/assets/icon.png` rendered on a navy rounded-square with safe-area padding.
- **Marketing render**: `logo.png` moves to `docs/brand/briefly-hero.png` as the canonical brand reference. The download page's dark hero is **recreated in CSS** (navy band + blue radial glows + inline vector mark) rather than serving the PNG — the compiled backend (`dist/`) has no asset-copy step, so shipping a binary through it would be brittle; the CSS hero reads identically. *(Amended during planning.)*

## Verification

- Backend suite stays green (download-page route test if any; branding change must not break `GET /download`).
- Frontend `tsc -b` + production build; desktop `npm run smoke` (strict: React must mount with 0 console errors) and a `--dir` build to confirm the product name/icon land.
- Preview verification: every renamed surface, favicon in the tab, palette applied (buttons/nav/login), no stray "MeetingListener" visible anywhere in the UI.
- `grep -ri meetinglistener` over frontend/desktop/mobile user-visible strings as the sweep's completeness check (excluding identifiers that intentionally stay).

## Rollout (deferred until the user says ship)

1. Deploy backend (download page rebrand).
2. Rebuild + upload both installers (Mac locally; Windows via the automated Parallels path), remove the old-named installer files from the server downloads dir.
3. Mobile display name ships whenever mobile next builds (no store presence yet).

## Out of scope

- Repo/GitHub rename, API domain change, server/service/tunnel/DB renames
- Electron `appId` or Expo slug changes
- Any dashboard layout/feature changes beyond color tokens and branding surfaces
