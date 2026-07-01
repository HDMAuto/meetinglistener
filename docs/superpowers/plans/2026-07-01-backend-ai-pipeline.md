# Backend AI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the AI pipeline to the MeetingListener backend — upload meeting audio, transcribe it (AssemblyAI), analyze it with Claude into a summary/goal/task list, resolve each task's assignee (with an "unsure → needs review" path), and notify assignees in-app.

**Architecture:** Builds on the Backend Foundation plan. An upload endpoint stores audio to local disk and kicks off an in-process background job. The job orchestrator (`processMeeting`) drives the meeting through statuses: `uploaded → transcribing → summarizing → ready` (or `failed`). Transcription and Claude calls live behind small modules so they can be mocked in tests. Assignee resolution is a pure function.

**Tech Stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL, `@anthropic-ai/sdk` (model `claude-opus-4-8`, structured outputs), AssemblyAI REST API (via `fetch`), multer (upload), zod, Vitest, supertest.

## Global Constraints

- **Everything from the Backend Foundation plan still applies** (ES modules with `.js` import extensions, `"strict": true`, JSON APIs, never return `passwordHash`, owner-scoped meeting access, cuid IDs).
- **Claude model:** `claude-opus-4-8`. Use **structured outputs** (`output_config.format` with a JSON schema) — never regex/parse free text.
- **External calls are mockable:** the AssemblyAI and Claude modules are imported by name so tests mock them with `vi.mock(...)`. No real network calls in tests.
- **Meeting.status** ∈ `recording | uploaded | transcribing | summarizing | ready | failed`.
- **Task.status** ∈ `needs_assignee | open | done`.
- **Assignees are app Users only** (v1). Notifications are in-app only for now; push is deferred to the mobile client phase.
- **Secrets** (`ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`) live in `.env` / `.env.test`, are gitignored, and are **optional** in the env schema so unrelated tests don't require them.

---

### Task 1: Dependencies + Prisma models (Transcript, Task, Notification)

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/prisma/schema.prisma`
- Test: (schema verified via Task 7+ tests; smoke via `prisma db push`)

**Interfaces:**
- Produces: Prisma models `Transcript`, `Task`, `Notification`; new `Meeting.errorMessage` field.

- [ ] **Step 1: Add dependencies to `backend/package.json`**

Add to `dependencies`:
```json
    "@anthropic-ai/sdk": "^0.68.0",
    "multer": "^1.4.5-lts.1"
```
Add to `devDependencies`:
```json
    "@types/multer": "^1.4.12"
```

- [ ] **Step 2: Install**

Run: `cd backend && npm install`
Expected: installs with no errors.

- [ ] **Step 3: Extend `backend/prisma/schema.prisma`**

Add `errorMessage` to the existing `Meeting` model and add three new models. The full `Meeting` model becomes:

```prisma
model Meeting {
  id           String       @id @default(cuid())
  ownerId      String
  owner        User         @relation(fields: [ownerId], references: [id])
  title        String
  status       String       @default("recording")
  audioUrl     String?
  durationSec  Int?
  goal         String?
  summary      String?
  errorMessage String?
  transcript   Transcript?
  tasks        Task[]
  createdAt    DateTime     @default(now())

  @@index([ownerId])
}

model Transcript {
  id        String   @id @default(cuid())
  meetingId String   @unique
  meeting   Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  fullText  String
  segments  Json?
  createdAt DateTime @default(now())
}

model Task {
  id                   String   @id @default(cuid())
  meetingId            String
  meeting              Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  description          String
  assigneeId           String?
  assignee             User?    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  assigneeText         String?
  suggestedAssigneeIds String[]
  status               String   @default("needs_assignee")
  notifiedAt           DateTime?
  createdAt            DateTime @default(now())

  @@index([meetingId])
  @@index([assigneeId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  taskId    String
  meetingId String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Also add the new relations to the existing `User` model — its body becomes:

```prisma
model User {
  id            String         @id @default(cuid())
  name          String
  email         String         @unique
  passwordHash  String
  pushToken     String?
  createdAt     DateTime       @default(now())
  meetings      Meeting[]
  assignedTasks Task[]         @relation("TaskAssignee")
  notifications Notification[]
}
```

- [ ] **Step 4: Sync the dev database**

Run: `cd backend && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema", client regenerated.

- [ ] **Step 5: Confirm the test suite still passes** (test DB reset picks up the new schema)

Run: `cd backend && npm test`
Expected: all existing tests still pass (24).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/prisma/schema.prisma
git commit -m "feat(backend): add Transcript, Task, Notification models + AI/upload deps"
```

---

### Task 2: Env vars for the AI keys

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env` (add real keys)
- Modify: `backend/.env.test` (add dummy keys)

**Interfaces:**
- Produces: `env.ANTHROPIC_API_KEY?: string`, `env.ASSEMBLYAI_API_KEY?: string`, and `env.UPLOAD_DIR: string` (default `"uploads"`).

- [ ] **Step 1: Replace `backend/src/config/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  UPLOAD_DIR: z.string().default("uploads"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 2: Add keys to `backend/.env`** (append these lines; fill in real values)

```
ANTHROPIC_API_KEY="sk-ant-..."
ASSEMBLYAI_API_KEY="your-assemblyai-key"
UPLOAD_DIR="uploads"
```

- [ ] **Step 3: Add dummy keys to `backend/.env.test`** (append)

```
ANTHROPIC_API_KEY="test-anthropic-key"
ASSEMBLYAI_API_KEY="test-assemblyai-key"
UPLOAD_DIR="uploads-test"
```

- [ ] **Step 4: Ignore the test upload dir** — add to `backend/.gitignore`:

```
uploads
uploads-test
```

- [ ] **Step 5: Run the suite** (nothing behavioral changed yet)

Run: `cd backend && npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/env.ts backend/.gitignore
git commit -m "feat(backend): add AI/upload env config"
```

---

### Task 3: Audio storage module

**Files:**
- Create: `backend/src/storage/audioStorage.ts`
- Test: `backend/tests/storage/audioStorage.test.ts`

**Interfaces:**
- Consumes: `env.UPLOAD_DIR` (Task 2).
- Produces:
  - `saveAudio(meetingId: string, buffer: Buffer, originalName: string): Promise<string>` — writes the file, returns a stored relative path like `uploads-test/<meetingId>.<ext>`.
  - `getAudioAbsolutePath(storedPath: string): string` — resolves a stored path to an absolute path.

- [ ] **Step 1: Write the failing test `backend/tests/storage/audioStorage.test.ts`**

```ts
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { saveAudio, getAudioAbsolutePath } from "../../src/storage/audioStorage.js";

describe("audioStorage", () => {
  afterAll(() => {
    rmSync("uploads-test", { recursive: true, force: true });
  });

  it("saves a buffer and returns a path that reads back", async () => {
    const stored = await saveAudio("meeting_abc", Buffer.from("hello-audio"), "clip.m4a");
    expect(stored).toContain("meeting_abc");
    expect(stored.endsWith(".m4a")).toBe(true);

    const abs = getAudioAbsolutePath(stored);
    expect(readFileSync(abs, "utf8")).toBe("hello-audio");
  });

  it("defaults the extension when the original name has none", async () => {
    const stored = await saveAudio("meeting_noext", Buffer.from("x"), "recording");
    expect(stored.endsWith(".bin")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && npx vitest run tests/storage/audioStorage.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/storage/audioStorage.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { env } from "../config/env.js";

export async function saveAudio(
  meetingId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  const ext = extname(originalName) || ".bin";
  const storedPath = join(env.UPLOAD_DIR, `${meetingId}${ext}`);
  await writeFile(storedPath, buffer);
  return storedPath;
}

export function getAudioAbsolutePath(storedPath: string): string {
  return resolve(storedPath);
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd backend && npx vitest run tests/storage/audioStorage.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storage/audioStorage.ts backend/tests/storage/audioStorage.test.ts
git commit -m "feat(backend): add local-disk audio storage"
```

---

### Task 4: Assignee resolution (pure function)

**Files:**
- Create: `backend/src/tasks/assigneeResolution.ts`
- Test: `backend/tests/tasks/assigneeResolution.test.ts`

**Interfaces:**
- Produces:
  - `type Confidence = "high" | "low" | "unknown"`
  - `interface Candidate { id: string; name: string }`
  - `interface Resolution { assigneeId: string | null; suggestedAssigneeIds: string[]; status: "open" | "needs_assignee" }`
  - `resolveAssignee(assigneeName: string, confidence: Confidence, users: Candidate[]): Resolution`

- [ ] **Step 1: Write the failing test `backend/tests/tasks/assigneeResolution.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveAssignee } from "../../src/tasks/assigneeResolution.js";

const users = [
  { id: "u_sarah", name: "Sarah Kim" },
  { id: "u_chrisA", name: "Chris Doe" },
  { id: "u_chrisB", name: "Chris Payne" },
  { id: "u_bob", name: "Bob Lee" },
];

describe("resolveAssignee", () => {
  it("assigns when confident and exactly one match", () => {
    const r = resolveAssignee("Sarah", "high", users);
    expect(r.assigneeId).toBe("u_sarah");
    expect(r.status).toBe("open");
    expect(r.suggestedAssigneeIds).toEqual([]);
  });

  it("needs review when multiple people match", () => {
    const r = resolveAssignee("Chris", "high", users);
    expect(r.assigneeId).toBeNull();
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual(["u_chrisA", "u_chrisB"]);
  });

  it("needs review when confidence is low even with one match", () => {
    const r = resolveAssignee("Bob", "low", users);
    expect(r.assigneeId).toBeNull();
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual(["u_bob"]);
  });

  it("needs review with no suggestions when nobody matches", () => {
    const r = resolveAssignee("Zoltan", "high", users);
    expect(r.assigneeId).toBeNull();
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && npx vitest run tests/tasks/assigneeResolution.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/tasks/assigneeResolution.ts`**

```ts
export type Confidence = "high" | "low" | "unknown";

export interface Candidate {
  id: string;
  name: string;
}

export interface Resolution {
  assigneeId: string | null;
  suggestedAssigneeIds: string[];
  status: "open" | "needs_assignee";
}

function matches(userName: string, target: string): boolean {
  const n = userName.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!t) return false;
  const first = n.split(/\s+/)[0];
  return n === t || first === t || n.includes(t) || t.includes(first);
}

export function resolveAssignee(
  assigneeName: string,
  confidence: Confidence,
  users: Candidate[],
): Resolution {
  const found = users.filter((u) => matches(u.name, assigneeName));
  if (confidence === "high" && found.length === 1) {
    return { assigneeId: found[0].id, suggestedAssigneeIds: [], status: "open" };
  }
  return {
    assigneeId: null,
    suggestedAssigneeIds: found.map((u) => u.id),
    status: "needs_assignee",
  };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd backend && npx vitest run tests/tasks/assigneeResolution.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/assigneeResolution.ts backend/tests/tasks/assigneeResolution.test.ts
git commit -m "feat(backend): add assignee resolution logic"
```

---

### Task 5: AI analyzer (Claude, structured output)

**Files:**
- Create: `backend/src/ai/anthropicClient.ts`
- Create: `backend/src/ai/analyzer.ts`
- Test: `backend/tests/ai/analyzer.test.ts`

**Interfaces:**
- Consumes: `@anthropic-ai/sdk`.
- Produces:
  - `interface AnalyzedTask { description: string; assignee: string; assigneeConfidence: "high" | "low" | "unknown" }`
  - `interface Analysis { goal: string; summary: string; tasks: AnalyzedTask[] }`
  - `analyzeTranscript(speakerLabeledText: string): Promise<Analysis>`
- `anthropicClient.ts` exports `anthropic` (an `Anthropic` instance) so the analyzer can be tested by mocking that module.

- [ ] **Step 1: Create `backend/src/ai/anthropicClient.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment automatically.
export const anthropic = new Anthropic();
```

- [ ] **Step 2: Write the failing test `backend/tests/ai/analyzer.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shared Anthropic client before importing the analyzer.
const createMock = vi.fn();
vi.mock("../../src/ai/anthropicClient.js", () => ({
  anthropic: { messages: { create: createMock } },
}));

import { analyzeTranscript } from "../../src/ai/analyzer.js";

describe("analyzeTranscript", () => {
  beforeEach(() => createMock.mockReset());

  it("returns the structured analysis Claude produces", async () => {
    const payload = {
      goal: "Plan the Q3 launch",
      summary: "The team discussed timelines and owners.",
      tasks: [
        { description: "Draft the press release", assignee: "Sarah", assigneeConfidence: "high" },
        { description: "Book the venue", assignee: "someone", assigneeConfidence: "unknown" },
      ],
    };
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(payload) }],
    });

    const result = await analyzeTranscript("Speaker A: let's plan the launch...");
    expect(result.goal).toBe("Plan the Q3 launch");
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1].assigneeConfidence).toBe("unknown");

    // It called Claude with the right model and a json_schema format.
    const arg = createMock.mock.calls[0][0];
    expect(arg.model).toBe("claude-opus-4-8");
    expect(arg.output_config.format.type).toBe("json_schema");
  });

  it("throws a clear error if Claude returns no text block", async () => {
    createMock.mockResolvedValue({ content: [] });
    await expect(analyzeTranscript("...")).rejects.toThrow("NO_ANALYSIS");
  });
});
```

- [ ] **Step 3: Run it — expect failure**

Run: `cd backend && npx vitest run tests/ai/analyzer.test.ts`
Expected: FAIL — cannot find module `analyzer.js`.

- [ ] **Step 4: Create `backend/src/ai/analyzer.ts`**

```ts
import { anthropic } from "./anthropicClient.js";

export interface AnalyzedTask {
  description: string;
  assignee: string;
  assigneeConfidence: "high" | "low" | "unknown";
}

export interface Analysis {
  goal: string;
  summary: string;
  tasks: AnalyzedTask[];
}

const SCHEMA = {
  type: "object",
  properties: {
    goal: { type: "string" },
    summary: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          assignee: { type: "string" },
          assigneeConfidence: { type: "string", enum: ["high", "low", "unknown"] },
        },
        required: ["description", "assignee", "assigneeConfidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["goal", "summary", "tasks"],
  additionalProperties: false,
} as const;

const SYSTEM = `You analyze meeting transcripts. Return:
- goal: one sentence stating what the meeting was trying to achieve.
- summary: a few short paragraphs covering the key topics discussed.
- tasks: action items assigned during the meeting. For each task, give the assignee's
  name exactly as heard, and assigneeConfidence: "high" if the transcript clearly names
  who is responsible, "low" if it is implied or ambiguous, "unknown" if no owner was stated.
If there are no action items, return an empty tasks array.`;

export async function analyzeTranscript(speakerLabeledText: string): Promise<Analysis> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: speakerLabeledText }],
  });

  const textBlock = response.content.find((b: { type: string }) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  if (!textBlock) throw new Error("NO_ANALYSIS");

  return JSON.parse(textBlock.text) as Analysis;
}
```

- [ ] **Step 5: Run it — expect pass**

Run: `cd backend && npx vitest run tests/ai/analyzer.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/ai/anthropicClient.ts backend/src/ai/analyzer.ts backend/tests/ai/analyzer.test.ts
git commit -m "feat(backend): add Claude AI analyzer with structured output"
```

---

### Task 6: AssemblyAI transcription client

**Files:**
- Create: `backend/src/transcription/assemblyai.ts`
- Test: `backend/tests/transcription/assemblyai.test.ts`

**Interfaces:**
- Consumes: `env.ASSEMBLYAI_API_KEY`, global `fetch`, `getAudioAbsolutePath` (Task 3).
- Produces:
  - `interface Utterance { speaker: string; text: string }`
  - `interface TranscriptionResult { text: string; speakerLabeledText: string; utterances: Utterance[]; durationSec: number }`
  - `transcribeAudio(storedPath: string): Promise<TranscriptionResult>` — uploads bytes, requests a transcript with speaker labels, polls to completion.

- [ ] **Step 1: Write the failing test `backend/tests/transcription/assemblyai.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { transcribeAudio } from "../../src/transcription/assemblyai.js";

describe("transcribeAudio", () => {
  beforeEach(() => {
    mkdirSync("uploads-test", { recursive: true });
    writeFileSync("uploads-test/m1.m4a", "fake-audio-bytes");
  });
  afterAll(() => rmSync("uploads-test", { recursive: true, force: true }));

  it("uploads, requests, polls, and returns speaker-labeled text", async () => {
    const fetchMock = vi.fn()
      // 1. upload
      .mockResolvedValueOnce({ ok: true, json: async () => ({ upload_url: "http://x/aud" }) })
      // 2. create transcript
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "t1", status: "queued" }) })
      // 3. poll -> completed
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "t1",
          status: "completed",
          text: "Hello everyone. Let's start.",
          audio_duration: 42,
          utterances: [
            { speaker: "A", text: "Hello everyone." },
            { speaker: "B", text: "Let's start." },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio("uploads-test/m1.m4a");
    expect(result.durationSec).toBe(42);
    expect(result.text).toContain("Hello everyone");
    expect(result.speakerLabeledText).toContain("Speaker A: Hello everyone.");
    expect(result.speakerLabeledText).toContain("Speaker B: Let's start.");

    vi.unstubAllGlobals();
  });

  it("throws when transcription errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ upload_url: "http://x/aud" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "t2", status: "queued" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "t2", status: "error", error: "bad audio" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeAudio("uploads-test/m1.m4a")).rejects.toThrow("bad audio");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && npx vitest run tests/transcription/assemblyai.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/transcription/assemblyai.ts`**

```ts
import { readFile } from "node:fs/promises";
import { env } from "../config/env.js";
import { getAudioAbsolutePath } from "../storage/audioStorage.js";

const BASE = "https://api.assemblyai.com/v2";

export interface Utterance {
  speaker: string;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  speakerLabeledText: string;
  utterances: Utterance[];
  durationSec: number;
}

function headers() {
  return { authorization: env.ASSEMBLYAI_API_KEY ?? "" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function transcribeAudio(storedPath: string): Promise<TranscriptionResult> {
  const bytes = await readFile(getAudioAbsolutePath(storedPath));

  // 1. Upload the audio bytes.
  const uploadRes = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: headers(),
    body: bytes,
  });
  if (!uploadRes.ok) throw new Error("ASSEMBLYAI_UPLOAD_FAILED");
  const { upload_url } = (await uploadRes.json()) as { upload_url: string };

  // 2. Request a transcript with speaker labels.
  const createRes = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, speaker_labels: true }),
  });
  if (!createRes.ok) throw new Error("ASSEMBLYAI_CREATE_FAILED");
  const created = (await createRes.json()) as { id: string };

  // 3. Poll until completed or error.
  for (;;) {
    const pollRes = await fetch(`${BASE}/transcript/${created.id}`, { headers: headers() });
    if (!pollRes.ok) throw new Error("ASSEMBLYAI_POLL_FAILED");
    const t = (await pollRes.json()) as {
      status: string;
      text?: string;
      error?: string;
      audio_duration?: number;
      utterances?: Utterance[];
    };

    if (t.status === "completed") {
      const utterances = t.utterances ?? [];
      const speakerLabeledText = utterances.length
        ? utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n")
        : (t.text ?? "");
      return {
        text: t.text ?? "",
        speakerLabeledText,
        utterances,
        durationSec: Math.round(t.audio_duration ?? 0),
      };
    }
    if (t.status === "error") throw new Error(t.error ?? "ASSEMBLYAI_ERROR");
    await sleep(3000);
  }
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd backend && npx vitest run tests/transcription/assemblyai.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/transcription/assemblyai.ts backend/tests/transcription/assemblyai.test.ts
git commit -m "feat(backend): add AssemblyAI transcription client"
```

---

### Task 7: Persistence — transcript, tasks-from-analysis, notifications

**Files:**
- Create: `backend/src/meetings/transcript.service.ts`
- Create: `backend/src/notifications/notification.service.ts`
- Create: `backend/src/tasks/task.service.ts`
- Test: `backend/tests/tasks/task.service.test.ts`

**Interfaces:**
- Consumes: `prisma` (foundation), `resolveAssignee` (Task 4), `Analysis` (Task 5).
- Produces:
  - `saveTranscript(meetingId: string, fullText: string, segments: unknown): Promise<void>`
  - `notifyAssignee(task: { id: string; assigneeId: string | null; meetingId: string }): Promise<void>` — if assigned, creates a Notification and sets `notifiedAt`.
  - `createTasksFromAnalysis(meetingId: string, analysis: Analysis): Promise<void>` — resolves each task against **all** users, creates Task rows, and notifies confidently-assigned ones.
  - `listMeetingTasks(meetingId: string): Promise<Task[]>`
  - `assignTask(taskId: string, assigneeId: string): Promise<Task>` — sets assignee, status `open`, notifies.
  - `completeTask(taskId: string): Promise<Task>` — sets status `done`.

- [ ] **Step 1: Write the failing test `backend/tests/tasks/task.service.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import {
  createTasksFromAnalysis,
  listMeetingTasks,
  assignTask,
  completeTask,
} from "../../src/tasks/task.service.js";

async function seed() {
  const owner = await createUser({ name: "Sarah Kim", email: "sarah@x.com", password: "hunter2" });
  await createUser({ name: "Bob Lee", email: "bob@x.com", password: "hunter2" });
  const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });
  return { owner, meeting };
}

describe("task.service", () => {
  it("creates tasks, auto-assigns confident matches, flags the rest, notifies", async () => {
    const { owner, meeting } = await seed();
    await createTasksFromAnalysis(meeting.id, {
      goal: "g",
      summary: "s",
      tasks: [
        { description: "Draft PR", assignee: "Sarah", assigneeConfidence: "high" },
        { description: "Book venue", assignee: "nobody", assigneeConfidence: "unknown" },
      ],
    });

    const tasks = await listMeetingTasks(meeting.id);
    expect(tasks).toHaveLength(2);

    const assigned = tasks.find((t) => t.description === "Draft PR")!;
    expect(assigned.assigneeId).toBe(owner.id);
    expect(assigned.status).toBe("open");
    expect(assigned.notifiedAt).not.toBeNull();

    const flagged = tasks.find((t) => t.description === "Book venue")!;
    expect(flagged.assigneeId).toBeNull();
    expect(flagged.status).toBe("needs_assignee");

    const notifs = await prisma.notification.findMany({ where: { userId: owner.id } });
    expect(notifs).toHaveLength(1);
  });

  it("assigns a flagged task and then completes it", async () => {
    const { owner, meeting } = await seed();
    await createTasksFromAnalysis(meeting.id, {
      goal: "g",
      summary: "s",
      tasks: [{ description: "Book venue", assignee: "nobody", assigneeConfidence: "unknown" }],
    });
    const [task] = await listMeetingTasks(meeting.id);

    const assigned = await assignTask(task.id, owner.id);
    expect(assigned.assigneeId).toBe(owner.id);
    expect(assigned.status).toBe("open");
    expect(assigned.notifiedAt).not.toBeNull();

    const done = await completeTask(task.id);
    expect(done.status).toBe("done");
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && npx vitest run tests/tasks/task.service.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/meetings/transcript.service.ts`**

```ts
import { prisma } from "../db/client.js";

export async function saveTranscript(
  meetingId: string,
  fullText: string,
  segments: unknown,
): Promise<void> {
  await prisma.transcript.upsert({
    where: { meetingId },
    create: { meetingId, fullText, segments: segments as object },
    update: { fullText, segments: segments as object },
  });
}
```

- [ ] **Step 4: Create `backend/src/notifications/notification.service.ts`**

```ts
import { prisma } from "../db/client.js";

export async function notifyAssignee(task: {
  id: string;
  assigneeId: string | null;
  meetingId: string;
}): Promise<void> {
  if (!task.assigneeId) return;
  await prisma.notification.create({
    data: { userId: task.assigneeId, taskId: task.id, meetingId: task.meetingId },
  });
  await prisma.task.update({ where: { id: task.id }, data: { notifiedAt: new Date() } });
}
```

- [ ] **Step 5: Create `backend/src/tasks/task.service.ts`**

```ts
import type { Task } from "@prisma/client";
import { prisma } from "../db/client.js";
import { resolveAssignee } from "./assigneeResolution.js";
import { notifyAssignee } from "../notifications/notification.service.js";
import type { Analysis } from "../ai/analyzer.js";

export async function createTasksFromAnalysis(
  meetingId: string,
  analysis: Analysis,
): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  for (const t of analysis.tasks) {
    const r = resolveAssignee(t.assignee, t.assigneeConfidence, users);
    const task = await prisma.task.create({
      data: {
        meetingId,
        description: t.description,
        assigneeText: t.assignee,
        assigneeId: r.assigneeId,
        suggestedAssigneeIds: r.suggestedAssigneeIds,
        status: r.status,
      },
    });
    if (r.assigneeId) {
      await notifyAssignee({ id: task.id, assigneeId: r.assigneeId, meetingId });
    }
  }
}

export async function listMeetingTasks(meetingId: string): Promise<Task[]> {
  return prisma.task.findMany({ where: { meetingId }, orderBy: { createdAt: "asc" } });
}

export async function assignTask(taskId: string, assigneeId: string): Promise<Task> {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId, status: "open" },
  });
  await notifyAssignee({ id: task.id, assigneeId, meetingId: task.meetingId });
  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
}

export async function completeTask(taskId: string): Promise<Task> {
  return prisma.task.update({ where: { id: taskId }, data: { status: "done" } });
}
```

- [ ] **Step 6: Run it — expect pass**

Run: `cd backend && npx vitest run tests/tasks/task.service.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/meetings/transcript.service.ts backend/src/notifications/notification.service.ts backend/src/tasks/task.service.ts backend/tests/tasks/task.service.test.ts
git commit -m "feat(backend): persist transcripts, tasks-from-analysis, notifications"
```

---

### Task 8: Pipeline orchestrator (`processMeeting`)

**Files:**
- Create: `backend/src/pipeline/processMeeting.ts`
- Test: `backend/tests/pipeline/processMeeting.test.ts`

**Interfaces:**
- Consumes: `transcribeAudio` (Task 6), `analyzeTranscript` (Task 5), `saveTranscript` + `createTasksFromAnalysis` (Task 7), `prisma`.
- Produces: `processMeeting(meetingId: string): Promise<void>` — drives statuses `transcribing → summarizing → ready`; on any failure sets `status: "failed"` + `errorMessage`.

- [ ] **Step 1: Write the failing test `backend/tests/pipeline/processMeeting.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const transcribeMock = vi.fn();
const analyzeMock = vi.fn();
vi.mock("../../src/transcription/assemblyai.js", () => ({ transcribeAudio: transcribeMock }));
vi.mock("../../src/ai/analyzer.js", () => ({ analyzeTranscript: analyzeMock }));

import { prisma } from "../../src/db/client.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { processMeeting } from "../../src/pipeline/processMeeting.js";

async function meetingWithAudio() {
  const owner = await createUser({ name: "Sarah Kim", email: "s@x.com", password: "hunter2" });
  const m = await createMeeting({ ownerId: owner.id, title: "Launch" });
  await prisma.meeting.update({ where: { id: m.id }, data: { audioUrl: "uploads-test/m.m4a" } });
  return { owner, meetingId: m.id };
}

describe("processMeeting", () => {
  beforeEach(() => {
    transcribeMock.mockReset();
    analyzeMock.mockReset();
  });

  it("runs the pipeline to ready and stores results", async () => {
    const { owner, meetingId } = await meetingWithAudio();
    transcribeMock.mockResolvedValue({
      text: "full text",
      speakerLabeledText: "Speaker A: hi",
      utterances: [{ speaker: "A", text: "hi" }],
      durationSec: 30,
    });
    analyzeMock.mockResolvedValue({
      goal: "Plan launch",
      summary: "Summary here",
      tasks: [{ description: "Draft PR", assignee: "Sarah", assigneeConfidence: "high" }],
    });

    await processMeeting(meetingId);

    const m = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(m.status).toBe("ready");
    expect(m.goal).toBe("Plan launch");
    expect(m.durationSec).toBe(30);

    const transcript = await prisma.transcript.findUnique({ where: { meetingId } });
    expect(transcript?.fullText).toBe("full text");

    const tasks = await prisma.task.findMany({ where: { meetingId } });
    expect(tasks[0].assigneeId).toBe(owner.id);
  });

  it("marks the meeting failed on a transcription error", async () => {
    const { meetingId } = await meetingWithAudio();
    transcribeMock.mockRejectedValue(new Error("bad audio"));

    await processMeeting(meetingId);

    const m = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(m.status).toBe("failed");
    expect(m.errorMessage).toContain("bad audio");
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd backend && npx vitest run tests/pipeline/processMeeting.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `backend/src/pipeline/processMeeting.ts`**

```ts
import { prisma } from "../db/client.js";
import { transcribeAudio } from "../transcription/assemblyai.js";
import { analyzeTranscript } from "../ai/analyzer.js";
import { saveTranscript } from "../meetings/transcript.service.js";
import { createTasksFromAnalysis } from "../tasks/task.service.js";

export async function processMeeting(meetingId: string): Promise<void> {
  try {
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    if (!meeting.audioUrl) throw new Error("NO_AUDIO");

    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "transcribing" } });
    const transcription = await transcribeAudio(meeting.audioUrl);
    await saveTranscript(meetingId, transcription.text, transcription.utterances);

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "summarizing", durationSec: transcription.durationSec },
    });
    const analysis = await analyzeTranscript(transcription.speakerLabeledText);
    await createTasksFromAnalysis(meetingId, analysis);

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "ready", goal: analysis.goal, summary: analysis.summary },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "failed", errorMessage: message },
    });
  }
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd backend && npx vitest run tests/pipeline/processMeeting.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pipeline/processMeeting.ts backend/tests/pipeline/processMeeting.test.ts
git commit -m "feat(backend): add meeting processing pipeline orchestrator"
```

---

### Task 9: Routes — audio upload, tasks, notifications

**Files:**
- Create: `backend/src/meetings/audio.routes.ts`
- Create: `backend/src/tasks/task.routes.ts`
- Create: `backend/src/notifications/notification.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/meetings/audio.routes.test.ts`
- Test: `backend/tests/tasks/task.routes.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `getMeeting`, `processMeeting`, `saveAudio`, task service, `prisma`.
- Produces (all require auth, all owner-scoped):
  - `POST /meetings/:id/audio` (multipart field `audio`) → `202 { meeting }`, kicks off `processMeeting` in the background.
  - `GET /meetings/:id/tasks` → `200 Task[]`
  - `POST /tasks/:id/assign` `{ assigneeId }` → `200 Task`
  - `POST /tasks/:id/complete` → `200 Task`
  - `GET /notifications` → `200 Notification[]` (current user's)
  - `POST /notifications/:id/read` → `200 Notification`

- [ ] **Step 1: Create `backend/src/meetings/audio.routes.ts`**

```ts
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/middleware.js";
import { getMeeting } from "./meeting.service.js";
import { saveAudio } from "../storage/audioStorage.js";
import { prisma } from "../db/client.js";
import { processMeeting } from "../pipeline/processMeeting.js";

export const audioRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

audioRouter.post("/:id/audio", requireAuth, upload.single("audio"), async (req, res) => {
  const meeting = await getMeeting(req.params.id, req.userId!);
  if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });

  const storedPath = await saveAudio(meeting.id, req.file.buffer, req.file.originalname);
  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { audioUrl: storedPath, status: "uploaded", errorMessage: null },
  });

  // Fire-and-forget background processing.
  void processMeeting(meeting.id);

  return res.status(202).json(updated);
});
```

- [ ] **Step 2: Create `backend/src/tasks/task.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { getMeeting } from "../meetings/meeting.service.js";
import { prisma } from "../db/client.js";
import { listMeetingTasks, assignTask, completeTask } from "./task.service.js";

export const meetingTaskRouter = Router({ mergeParams: true });
export const taskRouter = Router();

// GET /meetings/:id/tasks
meetingTaskRouter.get("/:id/tasks", requireAuth, async (req, res) => {
  const meeting = await getMeeting(req.params.id, req.userId!);
  if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(await listMeetingTasks(meeting.id));
});

async function ownsTask(taskId: string, userId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { meeting: true } });
  return !!task && task.meeting.ownerId === userId;
}

const assignSchema = z.object({ assigneeId: z.string().min(1) });

taskRouter.post("/:id/assign", requireAuth, async (req, res) => {
  if (!(await ownsTask(req.params.id, req.userId!))) return res.status(404).json({ error: "NOT_FOUND" });
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  return res.json(await assignTask(req.params.id, parsed.data.assigneeId));
});

taskRouter.post("/:id/complete", requireAuth, async (req, res) => {
  if (!(await ownsTask(req.params.id, req.userId!))) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(await completeTask(req.params.id));
});
```

- [ ] **Step 3: Create `backend/src/notifications/notification.routes.ts`**

```ts
import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  return res.json(notifications);
});

notificationRouter.post("/:id/read", requireAuth, async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId!) return res.status(404).json({ error: "NOT_FOUND" });
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  return res.json(updated);
});
```

- [ ] **Step 4: Replace `backend/src/app.ts` to mount the new routers**

```ts
import express, { type Express } from "express";
import { authRouter } from "./users/auth.routes.js";
import { meetingRouter } from "./meetings/meeting.routes.js";
import { audioRouter } from "./meetings/audio.routes.js";
import { meetingTaskRouter, taskRouter } from "./tasks/task.routes.js";
import { notificationRouter } from "./notifications/notification.routes.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/meetings", meetingRouter);
  app.use("/meetings", audioRouter);
  app.use("/meetings", meetingTaskRouter);
  app.use("/tasks", taskRouter);
  app.use("/notifications", notificationRouter);

  return app;
}
```

- [ ] **Step 5: Write `backend/tests/tasks/task.routes.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { createTasksFromAnalysis } from "../../src/tasks/task.service.js";
import { signToken } from "../../src/auth/jwt.js";

const app = createApp();

describe("task + notification routes", () => {
  it("lists tasks, assigns a flagged one, then completes it", async () => {
    const owner = await createUser({ name: "Sarah Kim", email: "o@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });
    await createTasksFromAnalysis(meeting.id, {
      goal: "g", summary: "s",
      tasks: [{ description: "Book venue", assignee: "nobody", assigneeConfidence: "unknown" }],
    });

    const list = await request(app)
      .get(`/meetings/${meeting.id}/tasks`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const taskId = list.body[0].id as string;
    expect(list.body[0].status).toBe("needs_assignee");

    const assigned = await request(app)
      .post(`/tasks/${taskId}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assigneeId: owner.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assigneeId).toBe(owner.id);

    const notifs = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(notifs.body).toHaveLength(1);

    const done = await request(app)
      .post(`/tasks/${taskId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(done.body.status).toBe("done");
  });

  it("returns 404 assigning a task you don't own", async () => {
    const owner = await createUser({ name: "A", email: "a2@x.com", password: "hunter2" });
    const other = await createUser({ name: "B", email: "b2@x.com", password: "hunter2" });
    const otherToken = signToken({ userId: other.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Private" });
    await createTasksFromAnalysis(meeting.id, {
      goal: "g", summary: "s",
      tasks: [{ description: "x", assignee: "nobody", assigneeConfidence: "unknown" }],
    });
    const [task] = await request(app)
      .get(`/meetings/${meeting.id}/tasks`)
      .set("Authorization", `Bearer ${signToken({ userId: owner.id })}`)
      .then((r) => r.body);

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ assigneeId: other.id });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6: Write `backend/tests/meetings/audio.routes.test.ts`**

```ts
import { describe, it, expect, vi, afterAll } from "vitest";
import { rmSync } from "node:fs";

// Prevent real background processing during the upload test.
vi.mock("../../src/pipeline/processMeeting.js", () => ({ processMeeting: vi.fn() }));

import request from "supertest";
import { createApp } from "../../src/app.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { signToken } from "../../src/auth/jwt.js";

const app = createApp();

describe("audio upload route", () => {
  afterAll(() => rmSync("uploads-test", { recursive: true, force: true }));

  it("accepts an upload and marks the meeting uploaded", async () => {
    const owner = await createUser({ name: "A", email: "up@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });

    const res = await request(app)
      .post(`/meetings/${meeting.id}/audio`)
      .set("Authorization", `Bearer ${token}`)
      .attach("audio", Buffer.from("fake-bytes"), "clip.m4a");

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("uploaded");
    expect(res.body.audioUrl).toContain(meeting.id);
  });

  it("rejects an upload with no file", async () => {
    const owner = await createUser({ name: "A", email: "up2@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });

    const res = await request(app)
      .post(`/meetings/${meeting.id}/audio`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7: Run the FULL suite**

Run: `cd backend && npm test`
Expected: PASS — all tests across every file, including the new route tests.

- [ ] **Step 8: Commit**

```bash
git add backend/src/meetings/audio.routes.ts backend/src/tasks/task.routes.ts backend/src/notifications/notification.routes.ts backend/src/app.ts backend/tests/tasks/task.routes.test.ts backend/tests/meetings/audio.routes.test.ts
git commit -m "feat(backend): add audio upload, task, and notification routes"
```

---

### Task 10: Manual end-to-end smoke test + README

**Files:**
- Modify: `backend/README.md`

**Interfaces:** Consumes everything. Requires **real** `ANTHROPIC_API_KEY` and `ASSEMBLYAI_API_KEY` in `.env`, and a short audio file to upload.

- [ ] **Step 1: Ensure real keys are set in `backend/.env`** (Anthropic + AssemblyAI).

- [ ] **Step 2: Start the server**

Run: `cd backend && npm run dev`
Expected: "MeetingListener backend listening on :3000".

- [ ] **Step 3: Register, create a meeting, upload audio** (second terminal)

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"pipeline@x.com","password":"hunter2"}' | sed 's/.*"token":"//;s/".*//')

MEETING=$(curl -s -X POST localhost:3000/meetings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Pipeline test"}' | sed 's/.*"id":"//;s/".*//')

# Upload a short audio file (replace path with a real recording)
curl -s -X POST localhost:3000/meetings/$MEETING/audio \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@/path/to/short-meeting.m4a"
```

- [ ] **Step 4: Poll the meeting until `ready`**

```bash
curl -s localhost:3000/meetings/$MEETING -H "Authorization: Bearer $TOKEN"
# status goes uploaded -> transcribing -> summarizing -> ready; then goal/summary populate
curl -s localhost:3000/meetings/$MEETING/tasks -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/notifications -H "Authorization: Bearer $TOKEN"
```
Expected: after processing, the meeting has `goal` + `summary`; tasks list is populated (some `open`, some `needs_assignee`); notifications exist for confidently-assigned tasks.

- [ ] **Step 5: Stop the server** (Ctrl+C).

- [ ] **Step 6: Update `backend/README.md`** — add under the endpoints list:

```markdown
## AI pipeline endpoints

- `POST /meetings/:id/audio` (auth, multipart `audio`) → 202; transcribes + analyzes in the background
- `GET /meetings/:id/tasks` (auth) → Task[]
- `POST /tasks/:id/assign` `{ assigneeId }` (auth) → Task
- `POST /tasks/:id/complete` (auth) → Task
- `GET /notifications` (auth) → Notification[]
- `POST /notifications/:id/read` (auth) → Notification

Requires `ANTHROPIC_API_KEY` and `ASSEMBLYAI_API_KEY` in `.env`. Meeting status flows
`uploaded → transcribing → summarizing → ready` (or `failed` with `errorMessage`).
```

- [ ] **Step 7: Commit**

```bash
git add backend/README.md
git commit -m "docs(backend): document AI pipeline endpoints"
```

---

## Self-Review

**Spec coverage:**
- Transcription (STT) → Tasks 6, 8 ✔ (AssemblyAI, speaker labels)
- AI summary/goal/tasks with structured output → Tasks 5, 8 ✔
- Assignee resolution incl. `needs_assignee` + `suggestedAssigneeIds` → Tasks 4, 7 ✔
- "Who is this for?" resolution flow (assign endpoint) → Task 9 ✔
- Notifications (in-app) for assignees → Tasks 7, 9 ✔ (push deferred to mobile phase — noted)
- Status-driven pipeline + `failed`/`errorMessage` → Tasks 1, 8 ✔
- Async processing (in-process background job) → Tasks 8, 9 ✔
- Audio upload + local storage → Tasks 3, 9 ✔
- Data model: Transcript, Task, Notification → Task 1 ✔

**Placeholder scan:** No TBD/TODO; every code step is complete. Real API keys and a sample audio file are required only for the Task 10 manual smoke test (explicitly called out).

**Type consistency:** `Analysis`/`AnalyzedTask` defined in Task 5, consumed in Tasks 7 & 8. `resolveAssignee` signature identical in Tasks 4 & 7. `TranscriptionResult` from Task 6 consumed in Task 8. `processMeeting(meetingId)` from Task 8 consumed in Task 9. Task/Notification Prisma models from Task 1 used throughout.

**Note:** Push notifications and search are intentionally out of scope here — search is its own later plan; push wiring lands with the mobile client.
