import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestUser } from "../helpers/users.js";
import { requireAdmin } from "../../src/auth/middleware.js";
import type { Request, Response } from "express";

const app = createApp();

describe("auth middleware roles", () => {
  it("rejects a deactivated user's still-valid token with 401", async () => {
    const user = await createTestUser({ email: "deact@mw.test", isActive: false });
    const res = await request(app)
      .get("/meetings")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(401);
  });

  it("still authenticates an active user", async () => {
    const user = await createTestUser({ email: "alive@mw.test" });
    const res = await request(app)
      .get("/meetings")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  it("requireAdmin rejects non-admins and passes admins", () => {
    const calls: number[] = [];
    const fakeRes = {
      status(code: number) {
        calls.push(code);
        return { json: () => undefined };
      },
    } as unknown as Response;

    let nextCalled = false;
    requireAdmin({ userRole: "member" } as Request, fakeRes, () => {
      nextCalled = true;
    });
    expect(calls).toEqual([403]);
    expect(nextCalled).toBe(false);

    requireAdmin({ userRole: "admin" } as Request, fakeRes, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
