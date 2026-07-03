# Search Feature — Design

**Date:** 2026-07-03
**Status:** Approved

## Goal

One unified search over everything a user can see — meeting metadata, transcript content, and tasks — surfaced as a ⌘K/Ctrl+K command palette in the web dashboard (and therefore the desktop app). Replaces "richer server-side search" from the original scope.

Decisions made during brainstorming:

- **Use case:** all of "find that meeting", "where was X discussed" (transcript snippets), and "find my action items" — one search box, grouped results.
- **UI:** command palette (⌘K / Ctrl+K) available anywhere in the authed app, plus a visible "Search… ⌘K" nav button. The existing dashboard client-side filter box stays unchanged.
- **Scope:** owner-only, matching every other endpoint. Assignee visibility across owners is explicitly out of scope (possible later feature).
- **Matching:** word-aware and ranked via Postgres full-text search (stemming, phrase support). No typo tolerance in v1.
- **Engine plumbing:** stored generated `tsvector` columns + GIN indexes (approach A). Rejected: on-the-fly `to_tsvector` (no indexes, degrades with transcript volume) and a unified search-document table (adds pipeline sync code that can drift).
- **Clients:** web + desktop in v1. Mobile reuses the same endpoint later with its own screen — out of scope here.

## Backend

### Migration (hand-written SQL)

Created with `prisma migrate dev --create-only`, then edited. Prisma can't express generated columns, so `schema.prisma` marks them `searchVector Unsupported("tsvector")?` to keep diffing honest.

- `Meeting.search_vector` — `GENERATED ALWAYS AS` weighted vector: `setweight(to_tsvector('english', title), 'A') || setweight(goal, 'B') || setweight(summary, 'C')` (null-safe via `coalesce`). Title hits outrank goal hits outrank summary hits.
- `Transcript.search_vector` — from `fullText`.
- `Task.search_vector` — from `description || coalesce(assigneeText)`.
- GIN index on each of the three columns.

Generated columns backfill existing rows on `ALTER TABLE` and are maintained by Postgres on every write — no pipeline changes, no sync code.

### Endpoint

`GET /search?q=<query>` — JWT-auth'd, owner-scoped. New module `backend/src/search/` (`search.routes.ts`, `search.service.ts`) following the existing module layout.

The service runs three parameterized `$queryRaw` queries against `websearch_to_tsquery('english', $q)` (handles quoted phrases, `-exclusions`, arbitrary user input without throwing). All queries filter by `ownerId`; transcripts and tasks join through their meeting. Ordered by `ts_rank`, `LIMIT 5` per group (palette shows top hits; no pagination in v1).

Response (200):

```jsonc
{
  "query": "deploy staging",
  "meetings":    [{ "id", "title", "status", "createdAt", "rank" }],
  "transcripts": [{ "meetingId", "meetingTitle", "snippet", "rank" }],
  "tasks":       [{ "id", "meetingId", "meetingTitle", "description",
                    "status", "assigneeName", "rank" }]
}
```

- Transcript `snippet` comes from `ts_headline`, with `StartSel`/`StopSel` set to control-character sentinels (`\u0001` / `\u0002`) that cannot occur in transcript text, so highlight markers are unambiguously ours even if a transcript literally contains `<mark>`. The frontend splits the snippet on the sentinels and wraps matched spans in highlight elements - all text rendered as text, never as HTML.
- Rules: missing/whitespace-only `q` → 400; `q` trimmed length < 2 → 400; query that parses to no lexemes (stopwords only) → 200 with empty groups.

## Frontend

New `CommandPalette.tsx` mounted once in the authed layout. No new libraries — an owned overlay + panel styled to the existing teal/orange design system (design skills applied at implementation time per standing preference).

- **Open:** ⌘K (mac) / Ctrl+K (windows/linux) global key handler, or the nav "Search… ⌘K" button. **Close:** Esc or overlay click.
- **Fetch:** input debounced ~250 ms → TanStack Query `GET /search`, `enabled` only when trimmed query ≥ 2 chars, previous data kept while typing (no flicker).
- **Results:** three labeled groups — Meetings, In transcripts (snippet with highlights), Tasks (status chip + assignee name). Snippet rendering splits on the sentinel markers and wraps matched spans in highlight elements — all content rendered as text, so transcript content can never inject HTML.
- **Keyboard:** ↑/↓ moves a single selection across the flattened group list, Enter navigates, Esc closes. Mouse hover + click also work.
- **Navigation:** every result type routes to `/meetings/:id` (meeting detail already shows transcript and tasks).
- **States:** idle hint, slow-fetch spinner, "No matches for ‘X’", inline error with retry.

Desktop needs no work (Electron wraps the same frontend build; renderer receives the shortcut).

## Error handling & security

- Query text only ever reaches SQL as a bound parameter inside Prisma's tagged-template `$queryRaw` — no interpolation, no injection.
- `websearch_to_tsquery` never throws on malformed input (unlike `to_tsquery`).
- Owner-scoping enforced in SQL in all three queries.
- 401 without a valid JWT (existing `requireAuth`); 400 for bad `q` as above.

## Testing

Vitest against the isolated `meetinglistener_test` DB (existing pattern; migrations build the test schema, so the generated columns/indexes are exercised implicitly).

- **Service:** seed two users with meetings/transcripts/tasks. Assert: matches found in each group; ranking (title hit outranks summary hit); stemming ("deploy" finds "deploying"); owner isolation (user B's data never returned to user A); stopword-only query returns empty groups; per-group limit respected.
- **Routes:** 401 unauthenticated; 400 for missing/short `q`; 200 response shape.

## Deployment

Standard update flow: rsync `backend/` with anchored excludes → on server `npm run migrate:deploy` (applies migration, backfills generated columns automatically) → `npm run build` → `pkill -f dist/server.js` (launchd restarts). API change is additive; existing clients unaffected. Web/desktop pick up the palette on their next bundle/DMG rebuild.

## Out of scope (v1)

- Typo tolerance / fuzzy matching (would need `pg_trgm` or an external engine)
- Assignee-visible or company-wide search scope
- Pagination / dedicated search page
- Mobile search screen (endpoint is ready for it)
- Deep-linking to a specific transcript segment/timestamp from a snippet
