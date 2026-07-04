# User Management — Design

**Date:** 2026-07-04
**Status:** Approved
**Sequence note:** First of two related features. "My Teams" (teams attached to meetings, scoping auto-assignment) is designed separately afterward and builds on the managed user list this feature creates.

## Goal

Admins create, edit, deactivate, and role-assign users from a User Management page. Self-registration — currently open to anyone who can reach the public API — is removed. Two roles: **admin** and **member**.

Decisions made during brainstorming:

- **Roles:** admin + member only. Admins see User Management and manage users; members use the app normally. Rejected: three-tier roles (no identified need), full RBAC permission tables (overkill for two roles), SSO (worthwhile later; layers on top of this without rework).
- **Onboarding:** admin creates the user with a temporary password shared out-of-band; user must change it on first login. No email infrastructure.
- **Removal = deactivation.** Inactive users cannot log in and vanish from pickers; their meetings, tasks, and history stay intact. Admins can reactivate. No hard delete in v1.
- **Bootstrap:** `npm run make-admin -- <email>` script, run once per environment.
- **Build order:** local commits only; push/deploy deferred until the user says so.

## Data model

Prisma migration (standard, generated — no hand-written SQL) adds to `User`:

```prisma
role               String  @default("member")   // "admin" | "member" — validated in code, like Meeting.status
isActive           Boolean @default(true)
mustChangePassword Boolean @default(false)
```

Defaults make every existing user (dev and prod) an active member at migration time.

## Backend

### Auth changes

- **`POST /auth/register` is removed** (route deleted; endpoint 404s). User creation is admin-only.
- **`POST /auth/login`**: rejects users with `isActive: false` → 403 `ACCOUNT_DISABLED`. Success response's `user` object now includes `role` and `mustChangePassword`.
- **`POST /auth/change-password`** (new, any authed user): `{ currentPassword, newPassword }` (newPassword min 6, matching the old register rule). Verifies `currentPassword`, updates the hash, clears `mustChangePassword`. 401 `INVALID_CREDENTIALS` if the current password is wrong.
- **`requireAuth`** additionally loads the user and rejects with 401 if the account no longer exists or is deactivated — a deactivated user's still-valid JWT stops working immediately.
- **`requireAdmin`** (new middleware, composed after `requireAuth`): 403 `FORBIDDEN` unless `role === "admin"`.

### User endpoints

| Endpoint | Who | Behavior |
|---|---|---|
| `GET /users` | any authed | Now returns only **active** users; payload gains `role`. Existing pickers automatically exclude deactivated people. |
| `GET /users/all` | admin | All users incl. deactivated: `id,name,email,role,isActive,createdAt`. |
| `POST /users` | admin | `{ name, email, role, tempPassword }` → creates with `mustChangePassword: true`. 409 `EMAIL_TAKEN`. |
| `PATCH /users/:id` | admin | Partial `{ name?, email?, role? }`. 409 `EMAIL_TAKEN` on email collision; 409 `LAST_ADMIN` if demoting the last active admin. |
| `POST /users/:id/deactivate` | admin | Sets `isActive: false`. 409 `LAST_ADMIN` if target is the last active admin. |
| `POST /users/:id/reactivate` | admin | Sets `isActive: true`. |
| `POST /users/:id/reset-password` | admin | `{ tempPassword }` → sets hash, sets `mustChangePassword: true`. |

All bodies zod-validated; errors are `{ error: "UPPER_SNAKE_CODE" }`; 404 `NOT_FOUND` for unknown ids. The **last-admin guard** counts active admins and refuses the operation that would leave zero.

### Bootstrap script

`backend/scripts/make-admin.ts`, wired as `npm run make-admin -- <email>`: sets `role: "admin"` on the matching user, prints confirmation; exits nonzero with a clear message if the email is unknown. Run once locally and once on the server at rollout.

## Frontend (web dashboard; desktop inherits the same build)

- **Login page**: the "Create an account" toggle/section is removed entirely.
- **Forced password change**: after login, if `user.mustChangePassword`, render a full-screen **Set a new password** form (current password, new password, confirm) instead of the app; the user cannot navigate anywhere until it succeeds. On success, proceed into the app normally.
- **Auth context**: persists `role` and `mustChangePassword` from the login response (same localStorage pattern as today). Role changes take effect at next login — no live refresh in v1.
- **User Management page** at `/admin/users`:
  - Sidebar entry "User Management" visible only when `role === "admin"`, placed under Notifications.
  - Route guard: non-admins are redirected to `/` (the API is the real enforcement).
  - Table of all users (`GET /users/all`): avatar initials, name, email, role chip (Admin teal / Member neutral), status (Active / Deactivated), created date.
  - **Add user** modal: name, email, role select, temp password field with a "generate" button and copy-to-clipboard; reminds the admin to share it out-of-band.
  - Row actions: **Edit** (name/email/role modal), **Reset password** (generates/sets temp password, shows it once with copy), **Deactivate**/**Reactivate** (confirm dialog; deactivate warns the person loses access immediately).
  - Errors surface inline (EMAIL_TAKEN on the email field; LAST_ADMIN as a dialog-level message).
- Styling follows the existing design system (teal/orange tokens, existing `ui.tsx` primitives; design skills applied at implementation).

## Clients not in scope

- **Mobile**: has no register screen; login keeps working. A `mustChangePassword` user completes the change on web/desktop once. Mobile ignores the new fields. No mobile release needed.
- Old deployed desktop/web bundles still show "Create an account" until rebuilt; the call now 404s — cosmetic, fixed by the next client rebuild.

## Testing

Vitest + supertest against the real test DB (existing patterns). Since `/auth/register` is gone, tests get a `createTestUser` helper that inserts via prisma (bcrypt hash) and mints a token via login (or signToken directly).

- **Middleware:** member hitting admin endpoint → 403; deactivated user's token → 401 on any authed route; admin passes.
- **Auth:** login blocked for inactive (403 ACCOUNT_DISABLED); login response carries role/mustChangePassword; change-password happy path clears the flag; wrong current password → 401; short new password → 400; register route → 404.
- **User CRUD:** create (member + admin, EMAIL_TAKEN), list active-only vs `/users/all`, patch (including EMAIL_TAKEN and LAST_ADMIN on demote), deactivate/reactivate (LAST_ADMIN on last active admin), reset-password sets flag.
- **make-admin script:** unit-level test of its core function (promote existing email; unknown email errors).

## Rollout (deferred — local commits only until the user says push/deploy)

1. Deploy backend: migration adds columns with safe defaults; all existing users become active members.
2. `npm run make-admin -- <the user's email>` on the server (and locally for dev).
3. Rebuild/ship web+desktop bundles whenever convenient; mobile untouched.

## Out of scope (v1)

- Hard delete of users
- Email delivery (invites, reset links)
- SSO / OAuth
- Live role refresh without re-login
- Mobile UI for password change or user admin
- Audit log of admin actions
