# Desktop Update Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The desktop app shows a dismissible "Briefly X is available" banner (linking to the download page) whenever the server's installers are newer than the running app.

**Architecture:** New public `GET /version` derives the highest semver from installer filenames in `DOWNLOADS_DIR`. The frontend bakes its own version in at build time (Vite define), polls `/version` 4-hourly when running under `file:` (Electron), and renders `UpdateBanner` with per-version dismissal in localStorage. Desktop's external-link handler already exists (`main.ts` `setWindowOpenHandler` → `shell.openExternal`) — verify-only. Spec: `docs/superpowers/specs/2026-07-05-update-notice-design.md`.

**Tech Stack:** Express 4 (sync route), vitest; Vite define, TanStack Query v5, Tailwind tokens.

## Global Constraints

- `/version` is PUBLIC (no requireAuth) and responds `{ latest: string | null }` — nothing else.
- Banner appears ONLY when: desktop context (`file:` protocol, or dev override `localStorage.briefly_force_update_banner === "1"`) AND `latest` strictly newer than `__APP_VERSION__` AND `latest !== localStorage.briefly_dismissed_version`. Absent on any error/null — never blocks the app.
- localStorage keys exactly: `briefly_dismissed_version`, `briefly_force_update_banner`.
- Version compare is numeric per dot-segment (`0.10.0 > 0.9.0`); malformed → treated as not-newer.
- Backend ESM `.js` imports; no new npm dependencies; error style unchanged (this endpoint has no error responses).
- Release rule (docs-level, from spec): frontend and desktop package versions bump together.
- LOCAL ONLY: no push/deploy. Commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Baseline: 103/103 backend tests; all typechecks/builds clean.

---

### Task 1: `GET /version` (TDD)

**Files:**
- Create: `backend/src/version/version.service.ts`, `backend/src/version/version.routes.ts`
- Modify: `backend/src/app.ts` (import + mount next to /health, BEFORE auth-gated routers)
- Test: `backend/tests/version/version.test.ts`

**Interfaces:**
- Produces: `latestVersionFrom(names: string[]): string | null`; route `GET /version` → 200 `{ latest }`. Task 2's `api.getLatestVersion` calls it.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/version/version.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { latestVersionFrom } from "../../src/version/version.service.js";

const app = createApp();

describe("latestVersionFrom", () => {
  it("parses versions out of real installer names and picks the highest", () => {
    expect(
      latestVersionFrom(["Briefly-0.2.0-universal.dmg", "Briefly Setup 0.3.0.exe"]),
    ).toBe("0.3.0");
  });

  it("compares segments numerically, not lexically", () => {
    expect(
      latestVersionFrom(["Briefly-0.9.0-universal.dmg", "Briefly-0.10.0-universal.dmg"]),
    ).toBe("0.10.0");
  });

  it("skips dotfiles, blockmaps, and unversioned names", () => {
    expect(
      latestVersionFrom([
        ".DS_Store",
        "Briefly-0.2.0-universal.dmg.blockmap",
        "readme.txt",
        "Briefly-0.2.0-universal.dmg",
      ]),
    ).toBe("0.2.0");
  });

  it("returns null when nothing is versioned", () => {
    expect(latestVersionFrom([])).toBeNull();
    expect(latestVersionFrom(["readme.txt"])).toBeNull();
  });
});

describe("GET /version", () => {
  it("is public and returns the latest shape", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("latest");
    expect(res.body.latest === null || typeof res.body.latest === "string").toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/version`
Expected: FAIL — module `../../src/version/version.service.js` not found.

- [ ] **Step 3: Implement**

Create `backend/src/version/version.service.ts`:

```typescript
const VERSION_RE = /(\d+)\.(\d+)\.(\d+)/;

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Highest X.Y.Z found in installer filenames; null when none qualify.
export function latestVersionFrom(names: string[]): string | null {
  let best: number[] | null = null;
  for (const name of names) {
    if (name.startsWith(".") || name.endsWith(".blockmap")) continue;
    const m = VERSION_RE.exec(name);
    if (!m) continue;
    const v = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!best || compare(v, best) > 0) best = v;
  }
  return best ? best.join(".") : null;
}
```

Create `backend/src/version/version.routes.ts`:

```typescript
import { Router } from "express";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.js";
import { latestVersionFrom } from "./version.service.js";

export const versionRouter = Router();
const dir = resolve(env.DOWNLOADS_DIR);

// Public: tells clients the newest installer version on the download page.
versionRouter.get("/", (_req, res) => {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    // downloads dir may not exist — report no version available.
  }
  res.json({ latest: latestVersionFrom(names) });
});
```

In `backend/src/app.ts`: add `import { versionRouter } from "./version/version.routes.js";` and mount directly after the `/health` route:

```typescript
  app.use("/version", versionRouter);
```

- [ ] **Step 4: Verify green + full suite**

Run: `cd backend && npx vitest run tests/version` → 5 PASS.
Run: `cd backend && npm test && npx tsc --noEmit` → 108/108, clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/version backend/src/app.ts backend/tests/version
git commit -m "feat(backend): public /version endpoint derived from installer filenames

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — baked version, banner, wiring

**Files:**
- Modify: `frontend/vite.config.ts` (define), `frontend/src/lib/api.ts` (method), `frontend/src/components/AppLayout.tsx` (mount)
- Create: `frontend/src/global.d.ts`, `frontend/src/lib/version.ts`, `frontend/src/components/UpdateBanner.tsx`

**Interfaces:**
- Consumes: `GET /version` (Task 1).
- Produces: `isNewerVersion(candidate: string, current: string): boolean`; `api.getLatestVersion(): Promise<{ latest: string | null }>`; `<UpdateBanner />`.

- [ ] **Step 1: Vite define + ambient type**

Replace `frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built app also works from file:// (Electron).
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
```

Create `frontend/src/global.d.ts`:

```typescript
// Injected at build time from package.json via vite.config.ts define.
declare const __APP_VERSION__: string;
```

- [ ] **Step 2: Version util + API method**

Create `frontend/src/lib/version.ts`:

```typescript
// True when candidate is strictly newer than current (numeric per segment;
// missing segments count as 0; malformed input is never "newer").
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10));
  const b = current.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x !== y) return x > y;
  }
  return false;
}
```

In `frontend/src/lib/api.ts`, add to the `api` object (new section after Notifications):

```typescript
  // App version
  getLatestVersion: () => request<{ latest: string | null }>("/version"),
```

- [ ] **Step 3: UpdateBanner component**

Create `frontend/src/components/UpdateBanner.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { isNewerVersion } from "../lib/version";

const DISMISS_KEY = "briefly_dismissed_version";
const FORCE_KEY = "briefly_force_update_banner";
const FOUR_HOURS = 4 * 60 * 60 * 1000;

// Only the Electron app can install updates; the web/dev instance never nags.
// The FORCE override exists so the banner can be exercised in browser previews.
const isDesktop =
  window.location.protocol === "file:" || localStorage.getItem(FORCE_KEY) === "1";

export function UpdateBanner() {
  const [dismissed, setDismissed] = useState<string | null>(
    localStorage.getItem(DISMISS_KEY),
  );

  const { data } = useQuery({
    queryKey: ["appVersion"],
    queryFn: api.getLatestVersion,
    enabled: isDesktop,
    refetchInterval: FOUR_HOURS,
    staleTime: FOUR_HOURS,
  });

  const latest = data?.latest ?? null;
  if (!isDesktop || !latest) return null;
  if (!isNewerVersion(latest, __APP_VERSION__)) return null;
  if (latest === dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, latest!);
    setDismissed(latest);
  }

  return (
    <div className="flex items-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2 text-sm">
      <svg
        className="h-4 w-4 shrink-0 text-brand-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 3v12M7 10l5 5 5-5M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex-1 font-medium text-brand-900">
        Briefly {latest} is available.
      </span>
      <a
        href="https://meetings-api.hdmauto.app/download"
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Download
      </a>
      <button
        onClick={dismiss}
        aria-label="Dismiss update notice"
        className="cursor-pointer rounded p-1 text-brand-700 transition-colors hover:bg-brand-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Mount in `frontend/src/components/AppLayout.tsx`**

Add `import { UpdateBanner } from "./UpdateBanner";` and change the main element to:

```tsx
      <main className="flex-1 overflow-y-auto">
        <UpdateBanner />
        <Outlet />
      </main>
```

- [ ] **Step 5: Verify + commit**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: both clean.

```bash
git add frontend/vite.config.ts frontend/src/global.d.ts frontend/src/lib/version.ts frontend/src/lib/api.ts frontend/src/components/UpdateBanner.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(frontend): desktop update banner with per-version dismissal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Verification (desktop handler check, smoke, preview)

**Files:** none — verification only.

- [ ] **Step 1: Confirm the external-link handler exists (spec's Desktop section — verify-only)**

Run: `grep -n "setWindowOpenHandler" desktop/src/main.ts`
Expected: a hit around line 27 (`shell.openExternal` + `action: "deny"`). NO code change — this shipped with the original desktop build.

- [ ] **Step 2: Suites + builds**

Run: `cd backend && npm test && npx tsc --noEmit` → 108/108, clean.
Run: `cd frontend && npx tsc -b && npm run build` → clean.
Run: `cd desktop && npm run smoke` → SMOKE_OK.

- [ ] **Step 3: Preview verification** (controller, main session)

Backend on :3000; frontend preview. In the browser console: `localStorage.setItem("briefly_force_update_banner", "1")`. To simulate a newer server version, drop a fake installer name into the local downloads dir: `mkdir -p backend/downloads && touch "backend/downloads/Briefly-9.9.9-universal.dmg"`, reload:
1. Banner appears: "Briefly 9.9.9 is available." with Download + ✕.
2. Download link points at the public download page (target _blank).
3. ✕ dismisses; reload — banner stays hidden (dismissed version persisted).
4. Bump the fake file to `Briefly-9.9.10-universal.dmg` → banner returns (per-version dismissal works).
5. Remove override + fake files (`rm backend/downloads/Briefly-9.9.*` and clear the two localStorage keys); confirm banner gone in normal web mode.
6. Screenshot the banner state for proof.

- [ ] **Step 4: Report**

No push/deploy. Note for rollout: deploying the backend activates `/version`; the banner reaches users with the next installer generation.
