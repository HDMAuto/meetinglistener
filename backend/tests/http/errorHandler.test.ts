import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../../src/http/asyncHandler.js";
import { errorHandler } from "../../src/http/errorHandler.js";
import { createApp } from "../../src/app.js";
import { createTestUser } from "../helpers/users.js";

function buildThrowawayApp(handler: (req: express.Request, res: express.Response) => Promise<unknown>) {
  const app = express();
  app.use(express.json());
  app.get("/boom", asyncHandler(handler));
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("maps an unexpected thrown error to 500 INTERNAL and the process survives", async () => {
    const app = buildThrowawayApp(async () => {
      throw new Error("boom");
    });

    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "INTERNAL" });
  });

  it("maps a P2002 email conflict to 409 EMAIL_TAKEN", async () => {
    const app = buildThrowawayApp(async () => {
      throw new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "5",
        meta: { target: ["email"] },
      });
    });

    const res = await request(app).get("/boom");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "EMAIL_TAKEN" });
  });

  it("never 500s on a concurrent duplicate-email POST /users race — always {201, 409}", async () => {
    const app = createApp();
    const admin = await createTestUser({ email: "race-admin@adm.test", role: "admin" });

    for (let i = 0; i < 5; i++) {
      const email = `race-${i}@adm.test`;
      const body = { name: "Racer", email, role: "member", tempPassword: "temp123" };

      const [a, b] = await Promise.all([
        request(app)
          .post("/users")
          .set("Authorization", `Bearer ${admin.token}`)
          .send(body),
        request(app)
          .post("/users")
          .set("Authorization", `Bearer ${admin.token}`)
          .send(body),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses, `iteration ${i}: got ${a.status} and ${b.status}`).toEqual([201, 409]);
    }
  });
});
