# MeetingListener Backend

Node.js + TypeScript + Express + Prisma (PostgreSQL) API. Records meeting audio,
transcribes it (AssemblyAI), and uses Claude to produce a summary, the meeting goal,
and an assigned task list.

## Setup

```bash
cd backend
npm install
createdb meetinglistener_dev
createdb meetinglistener_test
# create .env and .env.test (see below), then:
npx prisma db push        # sync schema to the dev database
```

`.env` (dev) and `.env.test` (tests) are gitignored. Example `.env`:

```
DATABASE_URL="postgresql://USER@localhost:5432/meetinglistener_dev?schema=public"
JWT_SECRET="dev-secret-change-me"
PORT=3000
UPLOAD_DIR="uploads"
ANTHROPIC_API_KEY="sk-ant-..."
ASSEMBLYAI_API_KEY="your-assemblyai-key"
```

`.env.test` is the same shape but points at `meetinglistener_test`, uses a different
`JWT_SECRET`, `UPLOAD_DIR="uploads-test"`, and can use dummy AI keys (tests mock the
external calls).

## Run

```bash
npm run dev          # dev server on :3000 (set PORT to change)
```

## Test

```bash
npm test             # full Vitest suite against the isolated meetinglistener_test DB
```

## Endpoints

### Auth & meetings (foundation)

- `GET /health`
- `POST /auth/register` `{ name, email, password }` → `{ token, user }`
- `POST /auth/login` `{ email, password }` → `{ token, user }`
- `POST /meetings` `{ title }` (auth) → Meeting
- `GET /meetings` (auth) → Meeting[]
- `GET /meetings/:id` (auth) → Meeting | 404

### AI pipeline

- `POST /meetings/:id/audio` (auth, multipart field `audio`) → `202` Meeting; transcribes
  and analyzes in the background.
- `GET /meetings/:id/tasks` (auth) → Task[]
- `POST /tasks/:id/assign` `{ assigneeId }` (auth) → Task
- `POST /tasks/:id/complete` (auth) → Task
- `GET /notifications` (auth) → Notification[]
- `POST /notifications/:id/read` (auth) → Notification

Requires `ANTHROPIC_API_KEY` and `ASSEMBLYAI_API_KEY` in `.env`. After upload, a meeting's
status flows `uploaded → transcribing → summarizing → ready` (or `failed`, with
`errorMessage` set). Tasks the AI is confident about are auto-assigned (`status: open`) and
their assignee is notified; uncertain ones are flagged `status: needs_assignee` with
`suggestedAssigneeIds` for a human to resolve via the assign endpoint.
