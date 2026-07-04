# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin/member roles with an admin-only User Management page; self-registration removed; deactivation instead of deletion; temp-password onboarding with forced first-login change.

**Architecture:** A standard Prisma migration adds `role`/`isActive`/`mustChangePassword` to `User`. `requireAuth` starts loading the user per-request (rejecting deactivated accounts) and a new `requireAdmin` guards admin-only user CRUD under `/users`. `POST /auth/register` is deleted; `POST /auth/change-password` added. Frontend: register UI removed, a forced password-change gate before the app, and a `/admin/users` page. Spec: `docs/superpowers/specs/2026-07-04-user-management-design.md`.

**Tech Stack:** Node 20+/TypeScript ESM, Express 4, Prisma 5.18 + PostgreSQL, zod, bcryptjs, vitest + supertest; React 18 + Vite + Tailwind, TanStack Query v5, react-router-dom v6.

## Global Constraints

- Backend is ESM: relative imports MUST end in `.js` (e.g. `../db/client.js`) even from `.ts` files.
- Error responses are `{ error: "UPPER_SNAKE_CODE" }`. Exact codes used in this plan: `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_BODY`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `EMAIL_TAKEN`, `LAST_ADMIN`, `NOT_FOUND`.
- Roles are exactly the strings `"admin"` and `"member"`; password minimum is 6 chars (unchanged rule).
- No new npm dependencies anywhere in this plan.
- Frontend styling uses existing design tokens (`brand-*`, `accent-*`, `ink`, `muted`, `shadow-card`, `shadow-pop`, `animate-fade-up`) and the primitives in `frontend/src/components/ui.tsx`.
- Run backend commands from `backend/` (`cd backend && ...`); commits from repo root.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- LOCAL ONLY: commit locally; do NOT `git push` and do NOT deploy to the server.
- Backend dev DB `meetinglistener_dev` (Prisma CLI auto-loads `backend/.env`); tests use `meetinglistener_test` via `backend/.env.test`; test DB is built by applying migrations.
- Baseline at plan start: 57 backend tests green, both typechecks clean.

---

### Task 1: Migration + user-model plumbing + test helper

**Files:**
- Modify: `backend/prisma/schema.prisma` (User model)
- Create: `backend/prisma/migrations/<timestamp>_add_user_roles/migration.sql` (Prisma-generated, no hand-editing)
- Modify: `backend/src/users/user.service.ts` (PublicUser + toPublicUser + listUsers)
- Modify: `backend/src/tasks/task.service.ts:11` (candidate fetch)
- Create: `backend/tests/helpers/users.ts`
- Test: `backend/tests/users/roles.plumbing.test.ts`

**Interfaces:**
- Produces (later tasks rely on these exactly):
  - `User` DB fields `role String @default("member")`, `isActive Boolean @default(true)`, `mustChangePassword Boolean @default(false)`
  - `PublicUser` = `{ id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; createdAt: Date }`
  - `listUsers(): Promise<PublicUser[]>` — active users only
  - Test helper `createTestUser(input: { email: string; name?: string; role?: "admin" | "member"; isActive?: boolean; mustChangePassword?: boolean; password?: string }): Promise<{ id: string; name: string; email: string; role: string; token: string }>` (defaults: name "Test User", role "member", active, password "hunter2")

- [ ] **Step 1: Add fields to the User model in `backend/prisma/schema.prisma`**

Below `pushToken String?` add:

```prisma
  role               String   @default("member")
  isActive           Boolean  @default(true)
  mustChangePassword Boolean  @default(false)
```

- [ ] **Step 2: Generate and apply the migration**

Run: `cd backend && npx prisma migrate dev --name add_user_roles`
Expected: `Applying migration ... add_user_roles`, `Your database is now in sync with your schema.` — no hand-editing needed (plain columns with defaults).

- [ ] **Step 3: Create the shared test helper**

Create `backend/tests/helpers/users.ts`:

```typescript
import { prisma } from "../../src/db/client.js";
import { hashPassword } from "../../src/auth/password.js";
import { signToken } from "../../src/auth/jwt.js";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

// Creates a user directly in the DB (self-registration no longer exists)
// and mints a JWT for it.
export async function createTestUser(input: {
  email: string;
  name?: string;
  role?: "admin" | "member";
  isActive?: boolean;
  mustChangePassword?: boolean;
  password?: string;
}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      name: input.name ?? "Test User",
      email: input.email,
      passwordHash: await hashPassword(input.password ?? "hunter2"),
      role: input.role ?? "member",
      isActive: input.isActive ?? true,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: signToken({ userId: user.id }),
  };
}
```

- [ ] **Step 4: Write the failing tests**

Create `backend/tests/users/roles.plumbing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createTestUser } from "../helpers/users.js";
import { listUsers } from "../../src/users/user.service.js";
import { createTasksFromAnalysis } from "../../src/tasks/task.service.js";

describe("role/isActive plumbing", () => {
  it("listUsers returns only active users and includes role", async () => {
    await createTestUser({ email: "active@plumb.test", name: "Active Al" });
    await createTestUser({ email: "gone@plumb.test", name: "Gone Greta", isActive: false });

    const users = await listUsers();

    expect(users.map((u) => u.email)).toEqual(["active@plumb.test"]);
    expect(users[0].role).toBe("member");
    expect(users[0].isActive).toBe(true);
  });

  it("auto-assignment never targets deactivated users", async () => {
    const owner = await createTestUser({ email: "owner@plumb.test" });
    await createTestUser({ email: "dana@plumb.test", name: "Dana", isActive: false });
    const meeting = await prisma.meeting.create({
      data: { ownerId: owner.id, title: "M", status: "ready" },
    });

    await createTasksFromAnalysis(meeting.id, {
      goal: "g",
      summary: "s",
      tasks: [{ description: "Do the thing", assignee: "Dana", assigneeConfidence: "high" }],
    });

    const tasks = await prisma.task.findMany({ where: { meetingId: meeting.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assigneeId).toBeNull();
    expect(tasks[0].status).toBe("needs_assignee");
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/users/roles.plumbing.test.ts`
Expected: FAIL — first test: inactive user still listed and/or `role` undefined on the payload; second test: task auto-assigned to Dana (`assigneeId` not null).

- [ ] **Step 6: Implement**

In `backend/src/users/user.service.ts`, replace `PublicUser`, `toPublicUser`, and `listUsers`:

```typescript
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

// Active users only — feeds assignee/team pickers.
export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return users.map(toPublicUser);
}
```

In `backend/src/tasks/task.service.ts`, change the candidate fetch (line 11):

```typescript
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
```

- [ ] **Step 7: Run tests to verify they pass, then the full suite**

Run: `cd backend && npx vitest run tests/users/roles.plumbing.test.ts`
Expected: 2 PASS.
Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all tests pass (57 pre-existing + 2 new), tsc clean.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma backend/src/users/user.service.ts backend/src/tasks/task.service.ts backend/tests/helpers backend/tests/users/roles.plumbing.test.ts
git commit -m "feat(backend): user role/isActive/mustChangePassword fields; active-only pickers and assignment

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Auth middleware — per-request user check + requireAdmin

**Files:**
- Modify: `backend/src/auth/types.ts`
- Modify: `backend/src/auth/middleware.ts`
- Test: `backend/tests/auth/roles.middleware.test.ts`

**Interfaces:**
- Consumes: `createTestUser` (Task 1).
- Produces: `requireAuth` (now async; also sets `req.userRole`; 401 for deactivated/deleted users) and `requireAdmin` (403 `FORBIDDEN` unless `req.userRole === "admin"`). Task 4 mounts `requireAdmin`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/auth/roles.middleware.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestUser } from "../helpers/users.js";
import { requireAdmin } from "../../src/auth/middleware.js";
import type { Request, Response } from "express";

const app = createApp();

describe("auth middleware roles", () => {
  it("rejects a deactivated user's still-valid token with 401", async () => {
    const user = await createTestUser({ email: "deact@mw.test", isActive: false });
    const res = await request(app)
      .get("/meetings")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(401);
  });

  it("still authenticates an active user", async () => {
    const user = await createTestUser({ email: "alive@mw.test" });
    const res = await request(app)
      .get("/meetings")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  it("requireAdmin rejects non-admins and passes admins", () => {
    const calls: number[] = [];
    const fakeRes = {
      status(code: number) {
        calls.push(code);
        return { json: () => undefined };
      },
    } as unknown as Response;

    let nextCalled = false;
    requireAdmin({ userRole: "member" } as Request, fakeRes, () => {
      nextCalled = true;
    });
    expect(calls).toEqual([403]);
    expect(nextCalled).toBe(false);

    requireAdmin({ userRole: "admin" } as Request, fakeRes, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/auth/roles.middleware.test.ts`
Expected: FAIL — deactivated-user test gets 200 (no DB check yet); `requireAdmin` import fails (not exported).

- [ ] **Step 3: Implement**

Replace `backend/src/auth/types.ts`:

```typescript
// Augment Express's Request so req.userId / req.userRole are typed everywhere.
import "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    userRole?: string;
  }
}
```

Replace `backend/src/auth/middleware.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.js";
import { prisma } from "../db/client.js";
import "./types.js";

// Verifies the JWT AND that the account still exists and is active, so a
// deactivated user's not-yet-expired token stops working immediately.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    const { userId } = verifyToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

// Mount after requireAuth.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}
```

- [ ] **Step 4: Run tests to verify they pass, then the full suite**

Run: `cd backend && npx vitest run tests/auth/roles.middleware.test.ts`
Expected: 3 PASS.
Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all pass (59 + 3 = 62), tsc clean. (Existing tests all use tokens for users that exist and are active, so the new DB check changes nothing for them.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth backend/tests/auth/roles.middleware.test.ts
git commit -m "feat(backend): requireAuth checks account is active; add requireAdmin guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Auth routes — remove register, harden login, add change-password

**Files:**
- Modify: `backend/src/users/auth.routes.ts`
- Modify: `backend/src/users/user.service.ts` (add `changePassword`)
- Modify: `backend/tests/users/auth.routes.test.ts` (full rewrite)
- Modify: `backend/tests/meetings/meeting.routes.test.ts` (swap register helper)
- Modify: `backend/tests/search/search.routes.test.ts` (swap register helper)

**Interfaces:**
- Consumes: `verifyCredentials` (returns `PublicUser`, which since Task 1 carries `role`/`isActive`/`mustChangePassword`); `requireAuth`; `createTestUser`.
- Produces: `POST /auth/login` → 403 `ACCOUNT_DISABLED` for inactive; success body `{ token, user }` where `user` includes `role` and `mustChangePassword`. `POST /auth/change-password` (authed) → 204 on success, 401 `INVALID_CREDENTIALS` on wrong current password, 400 `INVALID_BODY` for short new password. `POST /auth/register` → 404. `changePassword(userId, currentPassword, newPassword): Promise<boolean>`.

- [ ] **Step 1: Rewrite the auth route tests**

Replace the entire contents of `backend/tests/users/auth.routes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestUser } from "../helpers/users.js";

const app = createApp();

describe("auth routes", () => {
  it("no longer exposes registration", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "hunter2" });
    expect(res.status).toBe(404);
  });

  it("logs in an active user and returns role + mustChangePassword", async () => {
    await createTestUser({ email: "login@example.com", mustChangePassword: true });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "hunter2" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("member");
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects wrong credentials with 401", async () => {
    await createTestUser({ email: "wrongpw@example.com" });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "wrongpw@example.com", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a deactivated user with 403 ACCOUNT_DISABLED", async () => {
    await createTestUser({ email: "disabled@example.com", isActive: false });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "disabled@example.com", password: "hunter2" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ACCOUNT_DISABLED");
  });

  it("changes password, clears the flag, and new password works", async () => {
    const user = await createTestUser({
      email: "change@example.com",
      mustChangePassword: true,
    });

    const change = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ currentPassword: "hunter2", newPassword: "brandnew1" });
    expect(change.status).toBe(204);

    const relogin = await request(app)
      .post("/auth/login")
      .send({ email: "change@example.com", password: "brandnew1" });
    expect(relogin.status).toBe(200);
    expect(relogin.body.user.mustChangePassword).toBe(false);

    const oldPw = await request(app)
      .post("/auth/login")
      .send({ email: "change@example.com", password: "hunter2" });
    expect(oldPw.status).toBe(401);
  });

  it("rejects change-password with wrong current password", async () => {
    const user = await createTestUser({ email: "wrongcur@example.com" });
    const res = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ currentPassword: "nope", newPassword: "brandnew1" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects change-password with a short new password", async () => {
    const user = await createTestUser({ email: "short@example.com" });
    const res = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ currentPassword: "hunter2", newPassword: "abc" });
    expect(res.status).toBe(400);
  });

  it("requires auth for change-password", async () => {
    const res = await request(app)
      .post("/auth/change-password")
      .send({ currentPassword: "hunter2", newPassword: "brandnew1" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Migrate the two other register-dependent test files**

In BOTH `backend/tests/meetings/meeting.routes.test.ts` and `backend/tests/search/search.routes.test.ts`, replace the `registerAndToken` helper (keeping its name and call sites intact):

```typescript
import { createTestUser } from "../helpers/users.js";

async function registerAndToken(email: string): Promise<string> {
  return (await createTestUser({ email })).token;
}
```

and delete each file's now-unused `/auth/register` request code inside the old helper (the `request(app).post("/auth/register")...` block). Keep everything else unchanged.

- [ ] **Step 3: Run tests to verify they fail for the right reasons**

Run: `cd backend && npx vitest run tests/users/auth.routes.test.ts`
Expected: FAIL — register still returns 201 (route exists), change-password 404 (route missing), disabled login returns 200.

- [ ] **Step 4: Implement**

Add to `backend/src/users/user.service.ts`:

```typescript
// Verifies the current password before setting the new one; clears the
// first-login flag. Returns false when the user is unknown or the current
// password doesn't match.
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  return true;
}
```

Replace the entire contents of `backend/src/users/auth.routes.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { verifyCredentials, changePassword } from "./user.service.js";
import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: "ACCOUNT_DISABLED" });
  }
  const token = signToken({ userId: user.id });
  return res.status(200).json({ token, user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const ok = await changePassword(
    req.userId!,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!ok) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  return res.status(204).end();
});
```

Note: `createUser` stays in `user.service.ts` — Task 4's admin create builds on the same file. The old `register` route and its schema are gone.

- [ ] **Step 5: Run tests to verify they pass, then the full suite**

Run: `cd backend && npx vitest run tests/users/auth.routes.test.ts tests/meetings/meeting.routes.test.ts tests/search/search.routes.test.ts`
Expected: all PASS.
Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all pass (auth file went 4 → 8 tests: 62 + 4 = 66 total), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/users backend/tests/users/auth.routes.test.ts backend/tests/meetings/meeting.routes.test.ts backend/tests/search/search.routes.test.ts
git commit -m "feat(backend): remove public registration; block disabled logins; add change-password

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Admin user endpoints

**Files:**
- Modify: `backend/src/users/user.service.ts` (admin functions)
- Modify: `backend/src/users/user.routes.ts` (full replacement)
- Test: `backend/tests/users/admin.routes.test.ts`

**Interfaces:**
- Consumes: `requireAuth`/`requireAdmin` (Task 2), `toPublicUser`/`PublicUser`/`hashPassword` (existing), `createTestUser`.
- Produces endpoints (Task 6/7 frontend calls these):
  - `GET /users` (authed) — active only, includes `role`
  - `GET /users/all` (admin) — everyone
  - `POST /users` (admin) `{ name, email, role, tempPassword }` → 201 PublicUser (mustChangePassword true); 409 EMAIL_TAKEN
  - `PATCH /users/:id` (admin) `{ name?, email?, role? }` → 200; 404; 409 EMAIL_TAKEN | LAST_ADMIN
  - `POST /users/:id/deactivate` | `/reactivate` (admin) → 200; 404; deactivate: 409 LAST_ADMIN
  - `POST /users/:id/reset-password` (admin) `{ tempPassword }` → 200 (sets mustChangePassword); 404
- Service functions: `listAllUsers()`, `adminCreateUser(input)`, `adminUpdateUser(id, patch)` (null = not found; throws `EMAIL_TAKEN`/`LAST_ADMIN`), `setUserActive(id, active)` (null = not found; throws `LAST_ADMIN`), `adminResetPassword(id, tempPassword)` (null = not found).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/users/admin.routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestUser, type TestUser } from "../helpers/users.js";

const app = createApp();

let admin: TestUser;
let member: TestUser;

beforeEach(async () => {
  admin = await createTestUser({ email: "admin@adm.test", role: "admin", name: "Admin Amy" });
  member = await createTestUser({ email: "member@adm.test", name: "Member Max" });
});

describe("admin user endpoints", () => {
  it("blocks non-admins from every admin endpoint", async () => {
    const gets = await request(app)
      .get("/users/all")
      .set("Authorization", `Bearer ${member.token}`);
    expect(gets.status).toBe(403);

    const posts = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "X", email: "x@adm.test", role: "member", tempPassword: "temp123" });
    expect(posts.status).toBe(403);
  });

  it("GET /users hides deactivated users; GET /users/all shows them", async () => {
    await createTestUser({ email: "ghost@adm.test", name: "Ghost", isActive: false });

    const active = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${member.token}`);
    expect(active.status).toBe(200);
    expect(active.body.map((u: { email: string }) => u.email)).not.toContain("ghost@adm.test");

    const all = await request(app)
      .get("/users/all")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(all.status).toBe(200);
    expect(all.body.map((u: { email: string }) => u.email)).toContain("ghost@adm.test");
  });

  it("creates a user with mustChangePassword and rejects duplicate email", async () => {
    const res = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "New Nia", email: "nia@adm.test", role: "member", tempPassword: "temp123" });
    expect(res.status).toBe(201);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body.role).toBe("member");
    expect(res.body.passwordHash).toBeUndefined();

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "nia@adm.test", password: "temp123" });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    const dupe = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Dupe", email: "nia@adm.test", role: "member", tempPassword: "temp123" });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error).toBe("EMAIL_TAKEN");
  });

  it("edits name/email/role and 404s on unknown id", async () => {
    const res = await request(app)
      .patch(`/users/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Renamed", role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed");
    expect(res.body.role).toBe("admin");

    const missing = await request(app)
      .patch("/users/nonexistent-id")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "X" });
    expect(missing.status).toBe(404);
  });

  it("refuses to demote or deactivate the last active admin", async () => {
    const demote = await request(app)
      .patch(`/users/${admin.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "member" });
    expect(demote.status).toBe(409);
    expect(demote.body.error).toBe("LAST_ADMIN");

    const deact = await request(app)
      .post(`/users/${admin.id}/deactivate`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deact.status).toBe(409);
    expect(deact.body.error).toBe("LAST_ADMIN");
  });

  it("allows demotion when another active admin exists", async () => {
    await createTestUser({ email: "admin2@adm.test", role: "admin" });
    const demote = await request(app)
      .patch(`/users/${admin.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "member" });
    expect(demote.status).toBe(200);
    expect(demote.body.role).toBe("member");
  });

  it("deactivates and reactivates a member", async () => {
    const deact = await request(app)
      .post(`/users/${member.id}/deactivate`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deact.status).toBe(200);
    expect(deact.body.isActive).toBe(false);

    const blocked = await request(app)
      .post("/auth/login")
      .send({ email: "member@adm.test", password: "hunter2" });
    expect(blocked.status).toBe(403);

    const react = await request(app)
      .post(`/users/${member.id}/reactivate`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(react.status).toBe(200);
    expect(react.body.isActive).toBe(true);
  });

  it("resets a password to a temp one that must be changed", async () => {
    const res = await request(app)
      .post(`/users/${member.id}/reset-password`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ tempPassword: "resetme1" });
    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "member@adm.test", password: "resetme1" });
    expect(login.status).toBe(200);
  });

  it("validates bodies", async () => {
    const badRole = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "X", email: "x2@adm.test", role: "boss", tempPassword: "temp123" });
    expect(badRole.status).toBe(400);

    const emptyPatch = await request(app)
      .patch(`/users/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});
    expect(emptyPatch.status).toBe(400);

    const shortTemp = await request(app)
      .post(`/users/${member.id}/reset-password`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ tempPassword: "abc" });
    expect(shortTemp.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/users/admin.routes.test.ts`
Expected: FAIL — 404s on the new endpoints (not mounted).

- [ ] **Step 3: Implement the service functions**

Add to `backend/src/users/user.service.ts`:

```typescript
export async function listAllUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return users.map(toPublicUser);
}

// Throws LAST_ADMIN if no OTHER active admin exists besides targetId.
async function assertNotLastActiveAdmin(targetId: string): Promise<void> {
  const others = await prisma.user.count({
    where: { role: "admin", isActive: true, NOT: { id: targetId } },
  });
  if (others === 0) throw new Error("LAST_ADMIN");
}

export async function adminCreateUser(input: {
  name: string;
  email: string;
  role: "admin" | "member";
  tempPassword: string;
}): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.tempPassword),
      mustChangePassword: true,
    },
  });
  return toPublicUser(user);
}

// null = not found. Throws EMAIL_TAKEN / LAST_ADMIN.
export async function adminUpdateUser(
  id: string,
  patch: { name?: string; email?: string; role?: "admin" | "member" },
): Promise<PublicUser | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return null;
  if (patch.email && patch.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: patch.email } });
    if (existing) throw new Error("EMAIL_TAKEN");
  }
  if (patch.role === "member" && target.role === "admin" && target.isActive) {
    await assertNotLastActiveAdmin(id);
  }
  const user = await prisma.user.update({ where: { id }, data: patch });
  return toPublicUser(user);
}

// null = not found. Throws LAST_ADMIN when deactivating the last active admin.
export async function setUserActive(id: string, active: boolean): Promise<PublicUser | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return null;
  if (!active && target.role === "admin" && target.isActive) {
    await assertNotLastActiveAdmin(id);
  }
  const user = await prisma.user.update({ where: { id }, data: { isActive: active } });
  return toPublicUser(user);
}

// null = not found.
export async function adminResetPassword(
  id: string,
  tempPassword: string,
): Promise<PublicUser | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return null;
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  return toPublicUser(user);
}
```

(The old `createUser` function is now unused — delete it in the same edit.)

- [ ] **Step 4: Implement the routes**

Replace the entire contents of `backend/src/users/user.routes.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth/middleware.js";
import {
  listUsers,
  listAllUsers,
  adminCreateUser,
  adminUpdateUser,
  setUserActive,
  adminResetPassword,
} from "./user.service.js";

export const userRouter = Router();

userRouter.use(requireAuth);

// GET /users — active users only (assignee/team pickers). Any authed user.
userRouter.get("/", async (_req, res) => {
  return res.json(await listUsers());
});

// Everything below is admin-only.
userRouter.use(requireAdmin);

userRouter.get("/all", async (_req, res) => {
  return res.json(await listAllUsers());
});

const roleEnum = z.enum(["admin", "member"]);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: roleEnum,
  tempPassword: z.string().min(6),
});

userRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  try {
    const user = await adminCreateUser(parsed.data);
    return res.status(201).json(user);
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "EMAIL_TAKEN" });
    }
    throw err;
  }
});

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: roleEnum.optional(),
  })
  .refine((p) => Object.keys(p).length > 0);

userRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  try {
    const user = await adminUpdateUser(req.params.id, parsed.data);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(user);
  } catch (err) {
    if (err instanceof Error && (err.message === "EMAIL_TAKEN" || err.message === "LAST_ADMIN")) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

userRouter.post("/:id/deactivate", async (req, res) => {
  try {
    const user = await setUserActive(req.params.id, false);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(user);
  } catch (err) {
    if (err instanceof Error && err.message === "LAST_ADMIN") {
      return res.status(409).json({ error: "LAST_ADMIN" });
    }
    throw err;
  }
});

userRouter.post("/:id/reactivate", async (req, res) => {
  const user = await setUserActive(req.params.id, true);
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(user);
});

const resetSchema = z.object({ tempPassword: z.string().min(6) });

userRouter.post("/:id/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  const user = await adminResetPassword(req.params.id, parsed.data.tempPassword);
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(user);
});
```

`backend/tests/users/user.service.test.ts` tests the deleted `createUser` — replace that file's entire contents with the equivalent tests against `adminCreateUser`:

```typescript
import { describe, it, expect } from "vitest";
import {
  adminCreateUser,
  verifyCredentials,
  findUserById,
} from "../../src/users/user.service.js";

describe("user.service", () => {
  it("creates a user with mustChangePassword and never exposes the hash", async () => {
    const user = await adminCreateUser({
      name: "Ada",
      email: "ada@example.com",
      role: "member",
      tempPassword: "hunter2",
    });
    expect(user.email).toBe("ada@example.com");
    expect(user.mustChangePassword).toBe(true);
    expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    await adminCreateUser({ name: "Ada", email: "dupe@example.com", role: "member", tempPassword: "hunter2" });
    await expect(
      adminCreateUser({ name: "Bob", email: "dupe@example.com", role: "member", tempPassword: "hunter3" }),
    ).rejects.toThrow("EMAIL_TAKEN");
  });

  it("verifies correct credentials and rejects wrong ones", async () => {
    await adminCreateUser({ name: "Ada", email: "login@example.com", role: "member", tempPassword: "hunter2" });
    expect(await verifyCredentials("login@example.com", "hunter2")).not.toBeNull();
    expect(await verifyCredentials("login@example.com", "nope")).toBeNull();
    expect(await verifyCredentials("missing@example.com", "hunter2")).toBeNull();
  });

  it("finds a user by id", async () => {
    const created = await adminCreateUser({ name: "Ada", email: "id@example.com", role: "member", tempPassword: "hunter2" });
    const found = await findUserById(created.id);
    expect(found?.email).toBe("id@example.com");
  });
});
```

- [ ] **Step 5: Run tests to verify they pass, then the full suite**

Run: `cd backend && npx vitest run tests/users/admin.routes.test.ts`
Expected: 9 PASS.
Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all pass (66 + 9 = 75, ± any user.service.test.ts adjustments), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/users backend/tests/users
git commit -m "feat(backend): admin user CRUD with deactivation, reset-password, last-admin guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: make-admin bootstrap script

**Files:**
- Create: `backend/scripts/make-admin.ts`
- Modify: `backend/package.json` (scripts)
- Test: `backend/tests/users/make-admin.test.ts`

**Interfaces:**
- Produces: `npm run make-admin -- <email>` and exported `makeAdmin(email): Promise<"OK" | "NOT_FOUND">` (promotes to admin AND reactivates).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/users/make-admin.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createTestUser } from "../helpers/users.js";
import { makeAdmin } from "../../scripts/make-admin.js";

describe("makeAdmin", () => {
  it("promotes an existing user to active admin", async () => {
    const user = await createTestUser({ email: "promo@mk.test", isActive: false });
    const result = await makeAdmin("promo@mk.test");
    expect(result).toBe("OK");
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.role).toBe("admin");
    expect(fresh.isActive).toBe(true);
  });

  it("returns NOT_FOUND for an unknown email", async () => {
    expect(await makeAdmin("nobody@mk.test")).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/users/make-admin.test.ts`
Expected: FAIL — cannot find module `../../scripts/make-admin.js`.

- [ ] **Step 3: Implement**

Create `backend/scripts/make-admin.ts`:

```typescript
// Promote a user to admin (and reactivate them): npm run make-admin -- <email>
import { prisma } from "../src/db/client.js";

export async function makeAdmin(email: string): Promise<"OK" | "NOT_FOUND"> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return "NOT_FOUND";
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin", isActive: true },
  });
  return "OK";
}

// Only run as a CLI when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.includes("make-admin");
if (invokedDirectly && !process.env.VITEST) {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run make-admin -- <email>");
    process.exit(1);
  }
  makeAdmin(email)
    .then((result) => {
      if (result === "NOT_FOUND") {
        console.error(`No user found with email ${email}`);
        process.exit(1);
      }
      console.log(`${email} is now an active admin.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

In `backend/package.json`, add to `scripts`:

```json
    "make-admin": "node --env-file=.env --import tsx scripts/make-admin.ts",
```

- [ ] **Step 4: Run tests, full suite, and a live CLI check**

Run: `cd backend && npx vitest run tests/users/make-admin.test.ts`
Expected: 2 PASS.
Run: `cd backend && npm run make-admin -- demo@meetinglistener.app`
Expected: `demo@meetinglistener.app is now an active admin.` (promotes the dev-DB demo user — this also sets up Task 7's preview verification).
Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all pass (75 + 2 = 77), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts backend/package.json backend/tests/users/make-admin.test.ts
git commit -m "feat(backend): make-admin bootstrap script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend auth plumbing — types, api, login-only page, forced password change

**Files:**
- Modify: `frontend/src/lib/types.ts` (User + ManagedUser)
- Modify: `frontend/src/lib/api.ts` (remove register; add auth/user-admin methods)
- Modify: `frontend/src/auth/AuthContext.tsx` (full replacement)
- Modify: `frontend/src/pages/Login.tsx` (remove register mode)
- Create: `frontend/src/pages/ForcePasswordChange.tsx`
- Modify: `frontend/src/App.tsx` (gate on mustChangePassword)

**Interfaces:**
- Consumes: Task 3/4 endpoints.
- Produces (Task 7 relies on): `User` gains optional `role`/`isActive`/`mustChangePassword`; `ManagedUser` (all required); `api.changePassword`, `api.listAllUsers`, `api.createUser`, `api.updateUser`, `api.deactivateUser`, `api.reactivateUser`, `api.resetUserPassword`; `useAuth()` now `{ user, login, logout, updateStoredUser }` (no `register`).

- [ ] **Step 1: Update types**

In `frontend/src/lib/types.ts`, replace the `User` interface and add `ManagedUser` right below it:

```typescript
export type Role = "admin" | "member";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  // Optional: absent in user objects persisted to localStorage before this release.
  role?: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

// Full row for the admin User Management table (GET /users/all).
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
```

- [ ] **Step 2: Update the API client**

In `frontend/src/lib/api.ts`:
- Add `ManagedUser` to the type import list from `"./types"`.
- Delete the `register` method.
- Replace the `// Auth` and `// Users` sections of the `api` object with:

```typescript
  // Auth
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<void>("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),

  // Users
  listUsers: () => request<User[]>("/users"),
  listAllUsers: () => request<ManagedUser[]>("/users/all"),
  createUser: (body: { name: string; email: string; role: "admin" | "member"; tempPassword: string }) =>
    request<ManagedUser>("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; email?: string; role?: "admin" | "member" }) =>
    request<ManagedUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deactivateUser: (id: string) =>
    request<ManagedUser>(`/users/${id}/deactivate`, { method: "POST" }),
  reactivateUser: (id: string) =>
    request<ManagedUser>(`/users/${id}/reactivate`, { method: "POST" }),
  resetUserPassword: (id: string, tempPassword: string) =>
    request<ManagedUser>(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ tempPassword }),
    }),
```

- [ ] **Step 3: Replace AuthContext**

Replace the entire contents of `frontend/src/auth/AuthContext.tsx`:

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { api, setToken } from "../lib/api";
import type { User } from "../lib/types";

const USER_KEY = "ml_user";

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateStoredUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser());

  function persist(u: User, token: string) {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }

  const login: AuthState["login"] = async (email, password) => {
    const res = await api.login({ email, password });
    persist(res.user, res.token);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  // Patch the in-memory + persisted user (e.g. clearing mustChangePassword
  // after a successful forced change) without a fresh login round-trip.
  const updateStoredUser: AuthState["updateStoredUser"] = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 4: Make Login login-only**

In `frontend/src/pages/Login.tsx` (keep the brand panel and overall structure):
- `const { login, register } = useAuth();` → `const { login } = useAuth();`
- Delete the `mode` state and the `name` state.
- `onSubmit` becomes login-only; extend error mapping:

```tsx
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") setError("Wrong email or password.");
        else if (err.code === "ACCOUNT_DISABLED")
          setError("Your account has been deactivated. Contact your administrator.");
        else setError(err.message);
      } else {
        setError("Could not reach the server. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }
```

- In the form panel: heading is always `Welcome back` / subtitle `Sign in to your dashboard.`; delete the `{mode === "register" && (...) }` name field block; password input uses `autoComplete="current-password"`; button label `Sign in`; delete the entire `<p className="mt-6 ...">` mode-toggle paragraph ("New here? Create an account").

- [ ] **Step 5: Create the forced password change screen**

Create `frontend/src/pages/ForcePasswordChange.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { Button, Field, Input } from "../components/ui";

// Full-screen gate shown after login while user.mustChangePassword is set.
// The user cannot reach the app until the change succeeds.
export function ForcePasswordChange() {
  const { user, logout, updateStoredUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      updateStoredUser({ mustChangePassword: false });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setError("Current password is incorrect.");
      } else {
        setError("Could not change the password. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">
          Hi {user?.name.split(" ")[0]} — your password was set by an administrator. Choose your
          own to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Current (temporary) password" htmlFor="current">
            <Input
              id="current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="next">
            <Input
              id="next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Save new password
          </Button>
        </form>

        <button
          onClick={logout}
          className="mt-6 w-full cursor-pointer text-center text-sm font-medium text-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Gate the app in `frontend/src/App.tsx`**

Add the import:

```tsx
import { ForcePasswordChange } from "./pages/ForcePasswordChange";
```

Change the authed branch so the gate renders before any routes:

```tsx
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : user.mustChangePassword ? (
        <ForcePasswordChange />
      ) : (
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/meetings/:id" element={<MeetingDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
```

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: clean. (If anything still references `register` or the old `User` shape, the compiler will point at it — fix by deleting the stale reference.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib frontend/src/auth frontend/src/pages/Login.tsx frontend/src/pages/ForcePasswordChange.tsx frontend/src/App.tsx
git commit -m "feat(frontend): login-only auth, forced password change gate, admin user API client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: User Management page + navigation

**Files:**
- Create: `frontend/src/pages/UserManagement.tsx`
- Modify: `frontend/src/App.tsx` (route)
- Modify: `frontend/src/components/AppLayout.tsx` (admin-only nav item)

**Interfaces:**
- Consumes: `api.listAllUsers/createUser/updateUser/deactivateUser/reactivateUser/resetUserPassword`, `ManagedUser`, `useAuth().user.role`, ui primitives (`Button`, `Card`, `Field`, `Input`, `Modal`, `Spinner`, `cn`), `initials` from `../lib/format`.
- Produces: `/admin/users` route, sidebar "User Management" entry for admins.

- [ ] **Step 1: Create `frontend/src/pages/UserManagement.tsx`**

```tsx
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { ManagedUser, Role } from "../lib/types";
import { useAuth } from "../auth/AuthContext";
import { initials } from "../lib/format";
import { Button, Card, Field, Input, Modal, Spinner, cn } from "../components/ui";

function generateTempPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  // base36-ish, always >= 12 chars, no confusing symbols
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        role === "admin"
          ? "bg-brand-50 text-brand-700 ring-brand-200"
          : "bg-slate-50 text-slate-600 ring-slate-200",
      )}
    >
      {role === "admin" ? "Admin" : "Member"}
    </span>
  );
}

function TempPasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label="Temporary password" htmlFor="temp">
      <div className="flex gap-2">
        <Input
          id="temp"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          autoComplete="off"
        />
        <Button type="button" variant="outline" onClick={() => onChange(generateTempPassword())}>
          Generate
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!value}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Share it with them directly — they'll be asked to change it on first sign-in.
      </p>
    </Field>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "EMAIL_TAKEN") return "That email is already registered.";
    if (err.code === "LAST_ADMIN") return "You can't remove the last active admin.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}

export function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<ManagedUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: api.listAllUsers,
  });

  if (me?.role !== "admin") return <Navigate to="/" replace />;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["allUsers"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">User Management</h1>
          <p className="mt-1 text-sm text-muted">
            {users?.length ?? 0} account{(users?.length ?? 0) === 1 ? "" : "s"} · admins can add,
            edit, and deactivate users
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add user
        </Button>
      </header>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-bold">User</th>
                <th className="px-5 py-3 font-bold">Role</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className={cn("border-b border-slate-100", !u.isActive && "opacity-60")}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">
                          {u.name}
                          {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-muted">(you)</span>}
                        </div>
                        <div className="truncate text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <RoleChip role={u.role} />
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-semibold",
                        u.isActive ? "text-emerald-700" : "text-slate-500",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          u.isActive ? "bg-emerald-500" : "bg-slate-400",
                        )}
                      />
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(u.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setResetting(u)}>
                        Reset password
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn("px-2.5 py-1.5 text-xs", u.isActive ? "text-red-600 hover:bg-red-50" : "text-brand-600")}
                        onClick={() => setConfirmToggle(u)}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onDone={invalidate} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} onDone={invalidate} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} onDone={invalidate} />
      <ToggleActiveModal user={confirmToggle} onClose={() => setConfirmToggle(null)} onDone={invalidate} />
    </div>
  );
}

function AddUserModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createUser({ name, email, role, tempPassword }),
    onSuccess: () => {
      onDone();
      onClose();
      setName("");
      setEmail("");
      setRole("member");
      setTempPassword("");
      setError(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Add user">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Name" htmlFor="nu-name">
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" htmlFor="nu-email">
          <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <RoleSelect value={role} onChange={setRole} />
        <TempPasswordField value={tempPassword} onChange={setTempPassword} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <Field label="Role" htmlFor="role-select">
      <div className="flex gap-2" id="role-select">
        {(["member", "admin"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={cn(
              "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              value === r
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50",
            )}
          >
            {r === "admin" ? "Admin" : "Member"}
          </button>
        ))}
      </div>
    </Field>
  );
}

function EditUserModal({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (user && loadedFor !== user.id) {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setError(null);
    setLoadedFor(user.id);
  }

  const update = useMutation({
    mutationFn: () => api.updateUser(user!.id, { name, email, role }),
    onSuccess: () => {
      onDone();
      onClose();
      setLoadedFor(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={!!user} onClose={onClose} title="Edit user">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Name" htmlFor="eu-name">
          <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" htmlFor="eu-email">
          <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <RoleSelect value={role} onChange={setRole} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () => api.resetUserPassword(user!.id, tempPassword),
    onSuccess: () => {
      onDone();
      onClose();
      setTempPassword("");
      setError(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={!!user} onClose={onClose} title={`Reset password — ${user?.name ?? ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          They'll sign in with this temporary password and be asked to choose a new one.
        </p>
        <TempPasswordField value={tempPassword} onChange={setTempPassword} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={reset.isPending}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ToggleActiveModal({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const deactivating = user?.isActive ?? false;

  const toggle = useMutation({
    mutationFn: () =>
      deactivating ? api.deactivateUser(user!.id) : api.reactivateUser(user!.id),
    onSuccess: () => {
      onDone();
      onClose();
      setError(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={deactivating ? "Deactivate user?" : "Reactivate user?"}
    >
      <p className="text-sm text-muted">
        {deactivating
          ? `${user?.name} will immediately lose access and disappear from assignee pickers. Their meetings and task history stay intact. You can reactivate them anytime.`
          : `${user?.name} will be able to sign in again and appear in assignee pickers.`}
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={deactivating ? "accent" : "primary"}
          loading={toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          {deactivating ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Add the route in `frontend/src/App.tsx`**

Add the import and the route inside the `AppLayout` route group:

```tsx
import { UserManagement } from "./pages/UserManagement";
```

```tsx
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin/users" element={<UserManagement />} />
```

- [ ] **Step 3: Add the admin-only nav item in `frontend/src/components/AppLayout.tsx`**

Inside the `<nav>`, after the Notifications `NavItem`, add:

```tsx
          {user?.role === "admin" && (
            <NavItem
              to="/admin/users"
              label="User Management"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
                </svg>
              }
            />
          )}
```

- [ ] **Step 4: Typecheck + build**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: both clean.

- [ ] **Step 5: Verify in the browser preview** (controller performs this in the main session)

Backend running locally (`lsof -ti:3000 | xargs kill -9` first), frontend via preview tooling. The dev demo user is an admin after Task 5's CLI check.

1. Log in as `demo@meetinglistener.app` / `hunter2` → sidebar shows "User Management".
2. Open it → table lists users with role chips and status dots.
3. Add user (generate temp password, copy) → appears in table.
4. Log out, log in as the new user with the temp password → forced "Set a new password" screen; change it → app loads.
5. Log back in as demo. Edit the new user's role to admin → chip updates. Reset their password → succeeds.
6. Deactivate them → confirm dialog, row dims; try logging in as them → "deactivated" error on login.
7. Try deactivating yourself (demo, if now sole active admin) → LAST_ADMIN error surfaces.
8. Log in as a member → no "User Management" in sidebar; browsing to `/admin/users` redirects home.
9. Screenshot the table for proof.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/UserManagement.tsx frontend/src/App.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(frontend): admin User Management page with add/edit/reset/deactivate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Final regression pass

**Files:** none — verification only.

- [ ] **Step 1: Backend suite + typecheck**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all tests pass (≈77: 57 baseline + ~20 new across Tasks 1-5), tsc clean.

- [ ] **Step 2: Frontend typecheck + production build**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: clean.

- [ ] **Step 3: Report status**

No commit, no push, no deploy — the user decides when to ship. Rollout reminder for later (from the spec): deploy backend → `npm run migrate:deploy` → `npm run make-admin -- <their email>` on the server → restart → rebuild web/desktop bundles whenever convenient.
