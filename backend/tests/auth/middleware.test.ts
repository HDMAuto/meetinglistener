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