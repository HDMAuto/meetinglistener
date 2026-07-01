# MeetingListener — Design Spec (v1 / MVP)

**Date:** 2026-07-01
**Status:** Approved (design phase)

## 1. Purpose

MeetingListener listens to a meeting, transcribes it, and produces:

- a **summary** of what was discussed,
- the **goal** of the meeting,
- an **itemized task list** assigned to attendees, with notifications.

Meetings are viewed in a central, searchable dashboard, where each meeting opens
to its summary, notes, and assignments.

## 2. Platforms & scope

- **Clients:** cross-platform desktop (macOS + Windows) **and** mobile (iOS + Android).
- **Processing model:** record-then-process (record the full meeting, then transcribe
  and summarize when it ends). Live/real-time captioning is out of scope for v1.
- **Attendees / notifications:** app users only for v1 (in-app + push). Email/Slack/Teams
  integrations are v2+.
- **Data/AI location:** own cloud backend that calls hosted AI APIs. On-device processing
  is v2+.

### Explicitly out of scope for v1
Live captions; email/Slack/Teams notifications; on-device transcription/AI; multi-org/team
admin features.

## 3. Architecture

Three tiers:

```
CLIENTS (thin: capture audio + render dashboard)
  - Mobile: React Native (Expo) -> iOS, Android
  - Desktop: Electron or Tauri -> macOS, Windows
  - Shared: TypeScript UI components + API types
        |  HTTPS (REST + file upload)
        v
BACKEND (Node.js + TypeScript)
  - Auth & accounts        - Meeting/task storage
  - Audio upload handling  - Search API
  - Orchestrates AI jobs   - Push notifications
        |                          |
        v                          v
  Speech-to-Text API         Claude API
  (transcribe)               (summary, goal, tasks)
        |
        v
  Database + file storage
```

**Principle:** clients are thin (record audio, render data); the backend is the single
source of truth so a meeting recorded on one device appears on all the user's devices.

## 4. Stack

**TypeScript everywhere.**

- Mobile: React Native (Expo)
- Desktop: Electron or Tauri (share UI/types with mobile where practical)
- Backend: Node.js + TypeScript
- AI: a speech-to-text API (transcription) + the Claude API (analysis)
- One language across all clients and the server; shared API types.

## 5. Components (each has one job)

1. **Recorder (client)** — captures audio, record/stop UI, uploads file at meeting end.
   Desktop can capture system audio (Zoom/Meet/Teams); mobile captures mic (in-person).
2. **Meeting Service (backend)** — creates the meeting record, stores audio, tracks status.
3. **Transcription Worker** — sends audio to the STT API, saves the transcript.
4. **AI Analyzer** — sends transcript to Claude, returns structured {goal, summary, tasks}.
5. **Notification Service** — sends in-app + push notifications for assigned tasks.
6. **Dashboard (client)** — meeting list, search, and detail view (summary/notes/assignments).

## 6. Data model

- **User** — `id`, `name`, `email`, `passwordHash`, `pushToken`, `createdAt`
- **Meeting** — `id`, `ownerId`, `title`, `status`, `audioUrl`, `durationSec`, `goal`,
  `summary`, `createdAt`
- **Transcript** — `id`, `meetingId`, `fullText`, `segments` (optional timestamped chunks)
- **Task** — `id`, `meetingId`, `description`, `assigneeId` (nullable), `assigneeText`
  (raw name heard), `suggestedAssigneeIds`, `status`, `notifiedAt`, `createdAt`

Relations: a Meeting has one Transcript and many Tasks. Search runs over meeting title +
summary + transcript text.

**Meeting.status:** `recording` -> `uploaded` -> `transcribing` -> `summarizing` ->
`ready` | `failed`.

**Task.status:** `needs_assignee` | `open` | `done`.

## 7. AI output contract

The AI Analyzer requires structured JSON from Claude (via structured output):

```json
{
  "goal": "One-sentence statement of what the meeting was trying to achieve",
  "summary": "A few paragraphs covering the key topics discussed",
  "tasks": [
    {
      "description": "What needs to be done",
      "assignee": "Person's name as heard",
      "assigneeConfidence": "high | low | unknown"
    }
  ]
}
```

## 8. Assignee resolution (uncertain-assignee flow)

1. AI returns each task with `assignee` + `assigneeConfidence`.
2. Backend matches `assignee` to an app **User**.
3. **Confident single match** (`high` + exactly one user) -> `assigneeId` set,
   `status: open`, notification fires.
4. **Unsure** (`low`/`unknown`, or 0 / multiple matching users) -> `status: needs_assignee`,
   `assigneeId: null`, `assigneeText` kept, `suggestedAssigneeIds` pre-highlighted.
5. Meeting detail view shows a **"Who is this for?"** picker (dropdown of app users,
   suggestions first). On selection -> `assigneeId` set, `status: open`, notification fires.
6. Dashboard shows an "N tasks need review" badge.

No task is ever silently dropped or misassigned.

## 9. Error handling

- **Status-driven pipeline:** on transcription/AI failure, `Meeting.status = failed` with
  an error message; client shows "retry." Nothing silently disappears.
- **Async jobs:** transcription + AI run as background jobs (a queue) so uploads return
  immediately and long meetings don't time out.

## 10. Testing

- Unit-test the AI Analyzer and name-matching using recorded/fake transcripts (no live API).
- Integration-test the upload -> ready pipeline with a short sample audio file.
- STT and Claude calls are mocked in tests.

## 11. UI/UX approach

When building any client UI (dashboard, meeting list, search, meeting detail, task pickers),
use all available design skills — frontend-design, ui-ux-pro-max, emil-design-eng, and
animation-vocabulary — to ensure a distinctive, polished, non-generic interface.

## 12. Working style

Build step by step. The assistant provides code and exact file paths; the user creates the
files and writes the code. One step at a time, confirming before moving on.
```
