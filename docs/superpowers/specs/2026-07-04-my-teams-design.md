# My Teams — Design

**Date:** 2026-07-04
**Status:** Approved
**Sequence note:** Second of the two features requested together; builds on User Management (admin-managed active user list, roles). Completes the original "My Teams + User Management" request.

## Goal

Users create reusable, personal teams of people and optionally attach one to a meeting. When the meeting is processed, AI task auto-assignment considers **only that team's members**; without a team, behavior is unchanged (all active users).

Decisions made during brainstorming:

- **Attach model:** at most ONE team per meeting, optional. No team → today's behavior. Rejected: multiple teams (union pools — busier UI for no identified need), mandatory team (too rigid for ad-hoc recordings).
- **Strictness:** the team is a hard candidate boundary. A confidently-heard name that isn't on the team NEVER auto-assigns — the task lands as `needs_assignee` with the heard name (`assigneeText`) preserved and suggestions drawn only from team members. Consequence folded in: the meeting-detail assignee picker must still offer ALL active users (team members grouped first), or off-team flagged tasks could never be resolved.
- **Ownership:** teams are personal. Only the creator sees, edits, attaches, or deletes their teams; members are not notified and don't see teams they belong to. Matches the app's owner-scoped model.
- **Data model:** real `Team` entity + Prisma implicit m-n member relation (approach A). Rejected: memberId string arrays (no integrity), per-meeting attendee lists (kills reusability).
- Team edits/deletions never retroactively change already-processed meetings; assignment uses the team as it exists at processing time. Deleting a team nulls `Meeting.teamId` (history intact).

## Data model

Prisma migration (standard, generated — no hand-written SQL):

```prisma
model Team {
  id        String    @id @default(cuid())
  ownerId   String
  owner     User      @relation("TeamOwner", fields: [ownerId], references: [id])
  name      String
  members   User[]    @relation("TeamMembers")   // implicit m-n join table
  meetings  Meeting[]
  createdAt DateTime  @default(now())

  @@index([ownerId])
}
```

- `User` gains the back-relations: `ownedTeams Team[] @relation("TeamOwner")`, `teams Team[] @relation("TeamMembers")`.
- `Meeting` gains `teamId String?` and `team Team? @relation(fields: [teamId], references: [id], onDelete: SetNull)` plus `@@index([teamId])`.

## Backend

### Team endpoints (new module `backend/src/teams/` — `team.routes.ts`, `team.service.ts`; all `requireAuth`, owner-scoped)

| Endpoint | Behavior |
|---|---|
| `GET /teams` | Caller's teams, newest first, each with `members` (id, name, email — **active members only** in the payload). |
| `POST /teams` | `{ name (min 1), memberIds (string[], may be empty) }`. Every memberId must be an existing ACTIVE user → else 400 `INVALID_MEMBERS`. 201 with the team incl. members. |
| `PATCH /teams/:id` | `{ name?, memberIds? }` — non-empty patch; `memberIds` REPLACES the member set (same validation). 404 `NOT_FOUND` if not caller's team. |
| `DELETE /teams/:id` | 204. Referencing meetings keep history (`teamId` → null via FK). 404 if not caller's. |

Errors follow the house style `{ error: "UPPER_SNAKE_CODE" }`; zod validation on all bodies.

### Meeting changes

- `POST /meetings` body becomes `{ title, teamId? }`. If `teamId` present it must reference a team owned by the caller → else 400 `INVALID_TEAM`.
- `GET /meetings/:id` response includes `team: { id, name, members: [{ id, name }] } | null` (active members only) so the detail page can render the chip and group the picker.
- `GET /meetings` (list) is unchanged (no team data needed on cards in v1).

### Pipeline (the core behavior)

In `createTasksFromAnalysis(meetingId, analysis)`: fetch the meeting's `teamId`; candidates =
- team attached → the team's members `where isActive: true`
- no team → all users `where isActive: true` (exactly today's query)

`resolveAssignee` is untouched. Net effects, all at processing time:
- Confident unique match within candidates → auto-assign + in-app notification (existing flow).
- Confidently-heard non-team name → no candidate match → `needs_assignee`, `assigneeText` preserved, `suggestedAssigneeIds` empty or team-only.
- Ambiguous/low-confidence → `needs_assignee` with team-scoped suggestions.

`POST /tasks/:id/assign` (manual) is unchanged — it accepts any active user.

## Frontend (web dashboard; desktop inherits)

- **My Teams page** at `/teams`; sidebar entry "My Teams" between Meetings and Notifications (all users, no role gating).
  - Team cards: name, member count, member avatar initials (overlapping row), Edit / Delete actions. Empty state invites creating a first team.
  - Create/Edit modal: name field + member multi-select — checkbox list of active users (`GET /users`) with initials, name, email; selected count shown; save disabled on empty name.
  - Delete: confirm dialog noting meetings keep their history.
- **New Meeting modal**: optional "Team" `<select>` under the title — default "No team — anyone can be assigned", options from `GET /teams`. Sends `teamId` when chosen.
- **Meeting detail**: when the meeting has a team, a small chip (team name) beside the status badge. Assignee picker for `needs_assignee`/reassignment: all active users, **attached-team members grouped first** under a "Team" heading, everyone else under "Others".
- **Mobile**: out of scope v1. It creates meetings without `teamId` (still valid) and ignores the new response field.

## Testing

Vitest + supertest on the real test DB (existing patterns; migrations build the schema).

- **Team CRUD:** create with members; empty-member team; INVALID_MEMBERS for unknown AND inactive ids; list is owner-scoped (user B sees none of A's); PATCH replaces member set + renames; PATCH/DELETE of another user's team → 404; DELETE nulls `Meeting.teamId` on a referencing meeting.
- **Meeting creation:** with own teamId → 201, meeting persists teamId; with another user's teamId → 400 INVALID_TEAM; without teamId → unchanged; GET /meetings/:id includes team+members / null.
- **Pipeline (via `createTasksFromAnalysis`):** confident team-member match auto-assigns + notifies; confident NON-team name → needs_assignee with assigneeText preserved (the "Dana case"); ambiguous name suggestions contain only team members; no-team meeting matches against all active users (regression guard); deactivated team member never auto-assigned.
- **Route tests:** 401 unauthenticated on all /teams routes; body validation 400s.

## Deployment (whenever the user chooses; standard flow)

Additive migration + additive API: old desktop/mobile clients keep working (they simply never send `teamId`). rsync → `migrate:deploy` → build → restart; rebuild web/desktop bundles to expose the UI. No bootstrap step.

## Out of scope (v1)

- Shared/company-wide teams or admin visibility into others' teams
- Multiple teams per meeting
- Changing a processed meeting's team / re-running assignment
- Team-based notifications or team pages for members
- Mobile team UI
