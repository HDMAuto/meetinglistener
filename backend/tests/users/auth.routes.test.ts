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
