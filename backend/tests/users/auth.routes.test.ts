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
      .send({ name: "Ada", email: "dupe@example.com", password: "hunter2" });
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Bob", email: "dupe@example.com", password: "hunter3" });
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