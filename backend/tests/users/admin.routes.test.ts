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
