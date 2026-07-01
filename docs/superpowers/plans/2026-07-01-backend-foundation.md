# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MeetingListener backend foundation — a Node.js/TypeScript API with user accounts, JWT auth, and Meeting create/list/get — that everything else will build on.

**Architecture:** Express HTTP API in TypeScript. Prisma ORM over SQLite for local dev (swappable to Postgres later). Layered by feature: each feature has a `*.service.ts` (data/logic) and `*.routes.ts` (HTTP). Auth via bcrypt-hashed passwords + JWT bearer tokens. Test-first with Vitest + supertest.

**Tech Stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL, zod, bcryptjs, jsonwebtoken, Vitest, supertest.

> **Deviation note (2026-07-01):** During execution we switched the database from SQLite to **PostgreSQL** (the user has Postgres locally; it matches production). Concretely this changed: `schema.prisma` `provider = "postgresql"`; `.env`/`.env.test` use `postgresql://USER@localhost:5432/meetinglistener_dev|_test?schema=public`; `vitest.config.ts` loads `.env.test` and sets `test.env` so the suite runs against the isolated `meetinglistener_test` database; `tests/setup/global-setup.ts` force-resets that test DB. The as-built versions of `vitest.config.ts`, `tests/setup/global-setup.ts`, and `tests/setup/per-test.ts` live in the repo and supersede the SQLite snippets shown in Tasks 1–2 below. Two databases must exist: `createdb meetinglistener_dev && createdb meetinglistener_test`.

## Global Constraints

- **Language:** TypeScript everywhere; `"strict": true` in tsconfig.
- **Node:** Node 20+ (LTS).
- **Module system:** ES modules (`"type": "module"` in package.json), imports use `.js` extensions in source per NodeNext resolution.
- **All routes JSON.** Request/response bodies validated with zod at the HTTP boundary.
- **Never return `passwordHash`** in any API response — always serialize users through `toPublicUser`.
- **Meeting.status** is one of: `recording`, `uploaded`, `transcribing`, `summarizing`, `ready`, `failed`. New meetings default to `recording`.
- **IDs** are cuid strings (Prisma `@default(cuid())`).
- **Ownership:** a user can only read their own meetings.

---

### Task 1: Project scaffold + health endpoint

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.gitignore`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/health.test.ts`

**Interfaces:**
- Produces: `createApp(): Express` from `src/app.ts` — an Express app with `GET /health` returning `{ status: "ok" }`. Every later route task mounts onto this app.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "meetinglistener-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0",
    "bcryptjs": "^2.4.3",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.18.0",
    "supertest": "^7.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/.gitignore`**

```
node_modules
dist
*.db
*.db-journal
.env
.env.test
```

- [ ] **Step 4: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/per-test.ts"],
    fileParallelism: false,
  },
});
```

- [ ] **Step 5: Create `backend/src/app.ts`**

```ts
import express, { type Express } from "express";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
```

- [ ] **Step 6: Create `backend/src/server.ts`**

```ts
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`MeetingListener backend listening on :${port}`);
});
```

- [ ] **Step 7: Write the failing test `backend/tests/health.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 8: Install dependencies**

Run: `cd backend && npm install`
Expected: dependencies install, `node_modules` created, no errors.

- [ ] **Step 9: Create the test setup placeholders** (needed because vitest.config references them)

Create `backend/tests/setup/global-setup.ts`:

```ts
// Task 2 fills this in with DB reset. For now it is a no-op so tests can run.
export default async function globalSetup() {}
```

Create `backend/tests/setup/per-test.ts`:

```ts
// Task 2 fills this in with per-test cleanup. No-op for now.
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS — 1 test passing for `GET /health`.

- [ ] **Step 11: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold Express app with health endpoint"
```

---

### Task 2: Environment config, Prisma schema, DB client + test DB reset

**Files:**
- Create: `backend/.env`
- Create: `backend/.env.test`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/db/client.ts`
- Modify: `backend/tests/setup/global-setup.ts`
- Modify: `backend/tests/setup/per-test.ts`
- Test: `backend/tests/db/client.test.ts`

**Interfaces:**
- Produces: `env` from `src/config/env.ts` — `{ DATABASE_URL: string; JWT_SECRET: string; PORT: number }` (validated).
- Produces: `prisma` from `src/db/client.ts` — a shared `PrismaClient` instance. Every service imports this.
- Produces: `User` and `Meeting` Prisma models with the fields listed in the spec.

- [ ] **Step 1: Create `backend/.env`**

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret-change-me"
PORT=3000
```

- [ ] **Step 2: Create `backend/.env.test`**

```
DATABASE_URL="file:./test.db"
JWT_SECRET="test-secret"
PORT=3999
```

- [ ] **Step 3: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique
  passwordHash String
  pushToken    String?
  createdAt    DateTime  @default(now())
  meetings     Meeting[]
}

model Meeting {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  title       String
  status      String   @default("recording")
  audioUrl    String?
  durationSec Int?
  goal        String?
  summary     String?
  createdAt   DateTime @default(now())

  @@index([ownerId])
}
```

- [ ] **Step 4: Generate the client and create the dev DB**

Run: `cd backend && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema", Prisma Client generated, `prisma/dev.db` created.

- [ ] **Step 5: Create `backend/src/config/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(3000),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 6: Create `backend/src/db/client.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 7: Fill in `backend/tests/setup/global-setup.ts`**

```ts
import { execSync } from "node:child_process";

// Point every test at the test database, then reset its schema once.
export default async function globalSetup() {
  process.env.DATABASE_URL = "file:./test.db";
  process.env.JWT_SECRET = "test-secret";
  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
```

- [ ] **Step 8: Fill in `backend/tests/setup/per-test.ts`**

```ts
import { beforeEach } from "vitest";
import { prisma } from "../../src/db/client.js";

// Clean slate before each test. Delete children before parents.
beforeEach(async () => {
  await prisma.meeting.deleteMany();
  await prisma.user.deleteMany();
});
```

- [ ] **Step 9: Write the failing test `backend/tests/db/client.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";

describe("prisma client", () => {
  it("can create and read a user", async () => {
    const user = await prisma.user.create({
      data: { name: "Ada", email: "ada@example.com", passwordHash: "x" },
    });
    expect(user.id).toBeTruthy();

    const found = await prisma.user.findUnique({ where: { email: "ada@example.com" } });
    expect(found?.name).toBe("Ada");
  });
});
```

- [ ] **Step 10: Run the test**

Run: `cd backend && npm test`
Expected: PASS — the test DB is reset, the user round-trips. (`health.test.ts` still passes too.)

- [ ] **Step 11: Commit**

```bash
git add backend/
git commit -m "feat(backend): add env config, Prisma schema (User, Meeting), DB client + test DB reset"
```

---

### Task 3: Password hashing

**Files:**
- Create: `backend/src/auth/password.ts`
- Test: `backend/tests/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test `backend/tests/auth/password.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";

describe("password hashing", () => {
  it("hashes then verifies the correct password", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).not.toBe("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/auth/password.test.ts`
Expected: FAIL — cannot find module `../../src/auth/password.js`.

- [ ] **Step 3: Create `backend/src/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/auth/password.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/password.ts backend/tests/auth/password.test.ts
git commit -m "feat(backend): add password hashing helpers"
```

---

### Task 4: JWT sign/verify

**Files:**
- Create: `backend/src/auth/jwt.ts`
- Test: `backend/tests/auth/jwt.test.ts`

**Interfaces:**
- Produces: `signToken(payload: { userId: string }): string` and `verifyToken(token: string): { userId: string }` (throws on invalid/expired).

- [ ] **Step 1: Write the failing test `backend/tests/auth/jwt.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/auth/jwt.js";

describe("jwt", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signToken({ userId: "user_123" });
    expect(typeof token).toBe("string");
    expect(verifyToken(token)).toMatchObject({ userId: "user_123" });
  });

  it("throws on a tampered token", () => {
    expect(() => verifyToken("not.a.token")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/auth/jwt.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/auth/jwt.ts`**

```ts
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenPayload {
  userId: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || typeof decoded.userId !== "string") {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/auth/jwt.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/jwt.ts backend/tests/auth/jwt.test.ts
git commit -m "feat(backend): add JWT sign/verify helpers"
```

---

### Task 5: User service

**Files:**
- Create: `backend/src/users/user.service.ts`
- Test: `backend/tests/users/user.service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `hashPassword`/`verifyPassword` (Task 3).
- Produces:
  - `PublicUser` type = `{ id: string; name: string; email: string; createdAt: Date }`
  - `toPublicUser(user: User): PublicUser`
  - `createUser(input: { name: string; email: string; password: string }): Promise<PublicUser>` — throws `Error("EMAIL_TAKEN")` if email exists.
  - `verifyCredentials(email: string, password: string): Promise<PublicUser | null>`
  - `findUserById(id: string): Promise<PublicUser | null>`

- [ ] **Step 1: Write the failing test `backend/tests/users/user.service.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  createUser,
  verifyCredentials,
  findUserById,
} from "../../src/users/user.service.js";

describe("user.service", () => {
  it("creates a user and never exposes the hash", async () => {
    const user = await createUser({
      name: "Ada",
      email: "ada@example.com",
      password: "hunter2",
    });
    expect(user.email).toBe("ada@example.com");
    expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    await createUser({ name: "Ada", email: "dupe@example.com", password: "x" });
    await expect(
      createUser({ name: "Bob", email: "dupe@example.com", password: "y" }),
    ).rejects.toThrow("EMAIL_TAKEN");
  });

  it("verifies correct credentials and rejects wrong ones", async () => {
    await createUser({ name: "Ada", email: "login@example.com", password: "hunter2" });
    expect(await verifyCredentials("login@example.com", "hunter2")).not.toBeNull();
    expect(await verifyCredentials("login@example.com", "nope")).toBeNull();
    expect(await verifyCredentials("missing@example.com", "hunter2")).toBeNull();
  });

  it("finds a user by id", async () => {
    const created = await createUser({ name: "Ada", email: "id@example.com", password: "x" });
    const found = await findUserById(created.id);
    expect(found?.email).toBe("id@example.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/users/user.service.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/users/user.service.ts`**

```ts
import type { User } from "@prisma/client";
import { prisma } from "../db/client.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
  });
  return toPublicUser(user);
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return toPublicUser(user);
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/users/user.service.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/users/user.service.ts backend/tests/users/user.service.test.ts
git commit -m "feat(backend): add user service (create, verify, find)"
```

---

### Task 6: Auth routes (register + login)

**Files:**
- Create: `backend/src/users/auth.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/users/auth.routes.test.ts`

**Interfaces:**
- Consumes: `createUser`, `verifyCredentials` (Task 5), `signToken` (Task 4).
- Produces: `authRouter` (Express Router) mounted at `/auth`.
  - `POST /auth/register` `{ name, email, password }` → `201 { token, user: PublicUser }`; `409 { error: "EMAIL_TAKEN" }` on duplicate.
  - `POST /auth/login` `{ email, password }` → `200 { token, user: PublicUser }`; `401 { error: "INVALID_CREDENTIALS" }`.

- [ ] **Step 1: Write the failing test `backend/tests/users/auth.routes.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("auth routes", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "hunter2" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("ada@example.com");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects duplicate registration with 409", async () => {
    await request(app)
      .post("/auth/register")
      .send({ name: "Ada", email: "dupe@example.com", password: "x" });
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Bob", email: "dupe@example.com", password: "y" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid body with 400", async () => {
    const res = await request(app).post("/auth/register").send({ email: "bad" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    await request(app)
      .post("/auth/register")
      .send({ name: "Ada", email: "login@example.com", password: "hunter2" });

    const ok = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "hunter2" });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "nope" });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe("INVALID_CREDENTIALS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/users/auth.routes.test.ts`
Expected: FAIL — `/auth/register` returns 404 (router not mounted yet).

- [ ] **Step 3: Create `backend/src/users/auth.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { createUser, verifyCredentials } from "./user.service.js";
import { signToken } from "../auth/jwt.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });
  }
  try {
    const user = await createUser(parsed.data);
    const token = signToken({ userId: user.id });
    return res.status(201).json({ token, user });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "EMAIL_TAKEN" });
    }
    throw err;
  }
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
  const token = signToken({ userId: user.id });
  return res.status(200).json({ token, user });
});
```

- [ ] **Step 4: Mount the router — modify `backend/src/app.ts`**

Replace the file contents with:

```ts
import express, { type Express } from "express";
import { authRouter } from "./users/auth.routes.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/users/auth.routes.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/users/auth.routes.ts backend/src/app.ts backend/tests/users/auth.routes.test.ts
git commit -m "feat(backend): add register/login routes"
```

---

### Task 7: Auth middleware (requireAuth)

**Files:**
- Create: `backend/src/auth/types.ts`
- Create: `backend/src/auth/middleware.ts`
- Test: `backend/tests/auth/middleware.test.ts`

**Interfaces:**
- Consumes: `verifyToken` (Task 4).
- Produces: `requireAuth` Express middleware that reads `Authorization: Bearer <token>`, sets `req.userId`, or responds `401 { error: "UNAUTHORIZED" }`.
- Produces: type augmentation so `req.userId?: string` is typed on Express `Request`.

- [ ] **Step 1: Create the Request type augmentation `backend/src/auth/types.ts`**

```ts
// Augment Express's Request so req.userId is typed everywhere.
import "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}
```

- [ ] **Step 2: Write the failing test `backend/tests/auth/middleware.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth } from "../../src/auth/middleware.js";
import { signToken } from "../../src/auth/jwt.js";

function appWithProtectedRoute() {
  const app = express();
  app.get("/me", requireAuth, (req, res) => res.json({ userId: req.userId }));
  return app;
}

describe("requireAuth", () => {
  it("rejects a request with no token", async () => {
    const res = await request(appWithProtectedRoute()).get("/me");
    expect(res.status).toBe(401);
  });

  it("rejects a bad token", async () => {
    const res = await request(appWithProtectedRoute())
      .get("/me")
      .set("Authorization", "Bearer not.a.token");
    expect(res.status).toBe(401);
  });

  it("passes through with a valid token and sets userId", async () => {
    const token = signToken({ userId: "user_abc" });
    const res = await request(appWithProtectedRoute())
      .get("/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("user_abc");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/auth/middleware.test.ts`
Expected: FAIL — cannot find module `../../src/auth/middleware.js`.

- [ ] **Step 4: Create `backend/src/auth/middleware.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.js";
import "./types.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    const { userId } = verifyToken(header.slice("Bearer ".length));
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/auth/middleware.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/types.ts backend/src/auth/middleware.ts backend/tests/auth/middleware.test.ts
git commit -m "feat(backend): add requireAuth middleware"
```

---

### Task 8: Meeting service

**Files:**
- Create: `backend/src/meetings/meeting.service.ts`
- Test: `backend/tests/meetings/meeting.service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2).
- Produces:
  - `createMeeting(input: { ownerId: string; title: string }): Promise<Meeting>` — status defaults to `recording`.
  - `listMeetings(ownerId: string): Promise<Meeting[]>` — newest first.
  - `getMeeting(id: string, ownerId: string): Promise<Meeting | null>` — returns null if not found OR not owned by `ownerId`.
  - (`Meeting` is the Prisma model type.)

- [ ] **Step 1: Write the failing test `backend/tests/meetings/meeting.service.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createUser } from "../../src/users/user.service.js";
import {
  createMeeting,
  listMeetings,
  getMeeting,
} from "../../src/meetings/meeting.service.js";

async function makeUser(email: string) {
  return createUser({ name: "U", email, password: "x" });
}

describe("meeting.service", () => {
  it("creates a meeting with default status 'recording'", async () => {
    const owner = await makeUser("owner1@example.com");
    const meeting = await createMeeting({ ownerId: owner.id, title: "Standup" });
    expect(meeting.id).toBeTruthy();
    expect(meeting.title).toBe("Standup");
    expect(meeting.status).toBe("recording");
    expect(meeting.ownerId).toBe(owner.id);
  });

  it("lists only the owner's meetings, newest first", async () => {
    const a = await makeUser("a@example.com");
    const b = await makeUser("b@example.com");
    await createMeeting({ ownerId: a.id, title: "First" });
    await createMeeting({ ownerId: a.id, title: "Second" });
    await createMeeting({ ownerId: b.id, title: "Other" });

    const list = await listMeetings(a.id);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("Second");
    expect(list.every((m) => m.ownerId === a.id)).toBe(true);
  });

  it("gets a meeting only for its owner", async () => {
    const a = await makeUser("ga@example.com");
    const b = await makeUser("gb@example.com");
    const m = await createMeeting({ ownerId: a.id, title: "Private" });

    expect((await getMeeting(m.id, a.id))?.title).toBe("Private");
    expect(await getMeeting(m.id, b.id)).toBeNull();
    expect(await getMeeting("missing", a.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/meetings/meeting.service.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/meetings/meeting.service.ts`**

```ts
import type { Meeting } from "@prisma/client";
import { prisma } from "../db/client.js";

export async function createMeeting(input: {
  ownerId: string;
  title: string;
}): Promise<Meeting> {
  return prisma.meeting.create({
    data: { ownerId: input.ownerId, title: input.title },
  });
}

export async function listMeetings(ownerId: string): Promise<Meeting[]> {
  return prisma.meeting.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMeeting(id: string, ownerId: string): Promise<Meeting | null> {
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting || meeting.ownerId !== ownerId) return null;
  return meeting;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/meetings/meeting.service.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/meetings/meeting.service.ts backend/tests/meetings/meeting.service.test.ts
git commit -m "feat(backend): add meeting service (create, list, get, owner-scoped)"
```

---

### Task 9: Meeting routes

**Files:**
- Create: `backend/src/meetings/meeting.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/meetings/meeting.routes.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 7), `createMeeting`/`listMeetings`/`getMeeting` (Task 8), `signToken` (Task 4).
- Produces: `meetingRouter` mounted at `/meetings` (all routes require auth):
  - `POST /meetings` `{ title }` → `201 Meeting`
  - `GET /meetings` → `200 Meeting[]`
  - `GET /meetings/:id` → `200 Meeting` or `404 { error: "NOT_FOUND" }`

- [ ] **Step 1: Write the failing test `backend/tests/meetings/meeting.routes.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

async function registerAndToken(email: string): Promise<string> {
  const res = await request(app)
    .post("/auth/register")
    .send({ name: "U", email, password: "hunter2" });
  return res.body.token as string;
}

describe("meeting routes", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/meetings");
    expect(res.status).toBe(401);
  });

  it("creates and lists meetings for the owner", async () => {
    const token = await registerAndToken("owner@example.com");

    const created = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Standup" });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Standup");
    expect(created.body.status).toBe("recording");

    const list = await request(app)
      .get("/meetings")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("gets a meeting by id, 404 for other users", async () => {
    const ownerToken = await registerAndToken("g-owner@example.com");
    const otherToken = await registerAndToken("g-other@example.com");

    const created = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Private" });
    const id = created.body.id as string;

    const ok = await request(app)
      .get(`/meetings/${id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);

    const forbidden = await request(app)
      .get(`/meetings/${id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(404);
  });

  it("rejects creating a meeting with no title", async () => {
    const token = await registerAndToken("notitle@example.com");
    const res = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/meetings/meeting.routes.test.ts`
Expected: FAIL — `/meetings` returns 404 (router not mounted).

- [ ] **Step 3: Create `backend/src/meetings/meeting.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { createMeeting, listMeetings, getMeeting } from "./meeting.service.js";

export const meetingRouter = Router();

meetingRouter.use(requireAuth);

const createSchema = z.object({ title: z.string().min(1) });

meetingRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const meeting = await createMeeting({ ownerId: req.userId!, title: parsed.data.title });
  return res.status(201).json(meeting);
});

meetingRouter.get("/", async (req, res) => {
  const meetings = await listMeetings(req.userId!);
  return res.json(meetings);
});

meetingRouter.get("/:id", async (req, res) => {
  const meeting = await getMeeting(req.params.id, req.userId!);
  if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(meeting);
});
```

- [ ] **Step 4: Mount the router — modify `backend/src/app.ts`**

Replace the file contents with:

```ts
import express, { type Express } from "express";
import { authRouter } from "./users/auth.routes.js";
import { meetingRouter } from "./meetings/meeting.routes.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/meetings", meetingRouter);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/meetings/meeting.routes.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Run the FULL test suite**

Run: `cd backend && npm test`
Expected: PASS — all tests across every file green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/meetings/meeting.routes.ts backend/src/app.ts backend/tests/meetings/meeting.routes.test.ts
git commit -m "feat(backend): add meeting routes (create, list, get)"
```

---

### Task 10: Manual smoke test + README

**Files:**
- Create: `backend/README.md`

**Interfaces:**
- Consumes: everything above. No new code.

- [ ] **Step 1: Start the server**

Run: `cd backend && npm run dev`
Expected: "MeetingListener backend listening on :3000".

- [ ] **Step 2: Smoke-test the full flow with curl** (in a second terminal)

```bash
# health
curl -s localhost:3000/health

# register
curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"hunter2"}'

# copy the token from the response, then:
TOKEN="<paste-token>"

# create a meeting
curl -s -X POST localhost:3000/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Sprint planning"}'

# list meetings
curl -s localhost:3000/meetings -H "Authorization: Bearer $TOKEN"
```
Expected: health returns `{"status":"ok"}`; register returns a token + user; create returns a meeting with `"status":"recording"`; list returns an array with that meeting.

- [ ] **Step 3: Create `backend/README.md`**

```markdown
# MeetingListener Backend

Node.js + TypeScript + Express + Prisma (SQLite) API.

## Setup

```bash
cd backend
npm install
npx prisma db push   # creates dev.db from the schema
```

## Run

```bash
npm run dev          # dev server on :3000 (PORT env to change)
```

## Test

```bash
npm test             # runs the full Vitest suite against test.db
```

## Endpoints (v1 foundation)

- `GET /health`
- `POST /auth/register` `{ name, email, password }` → `{ token, user }`
- `POST /auth/login` `{ email, password }` → `{ token, user }`
- `POST /meetings` `{ title }` (auth) → Meeting
- `GET /meetings` (auth) → Meeting[]
- `GET /meetings/:id` (auth) → Meeting | 404
```

- [ ] **Step 4: Stop the dev server** (Ctrl+C in the server terminal).

- [ ] **Step 5: Commit**

```bash
git add backend/README.md
git commit -m "docs(backend): add setup/run/test README"
```

---

## Self-Review

**Spec coverage (foundation subset):**
- User model + accounts → Tasks 2, 5, 6 ✔
- Auth (hashing, JWT, middleware) → Tasks 3, 4, 7 ✔
- Meeting model + create/list/get, owner-scoped → Tasks 2, 8, 9 ✔
- Meeting.status default `recording` from the spec's status set → Tasks 2, 8 ✔
- Transcript, Task, AI pipeline, search, notifications → intentionally deferred to later plans (out of scope for this foundation plan).

**Placeholder scan:** No TBD/TODO; every code step has complete code. The Task 1 test-setup files are deliberate no-ops that Task 2 fills in (called out explicitly).

**Type consistency:** `PublicUser` shape identical in Task 5 and consumed in Task 6. `signToken({ userId })`/`verifyToken → { userId }` consistent across Tasks 4, 7, 9. `createMeeting/listMeetings/getMeeting` signatures identical in Tasks 8 and 9. `req.userId` typed in Task 7, used in Task 9.
```
