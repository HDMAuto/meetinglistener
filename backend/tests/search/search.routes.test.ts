import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

async function registerAndToken(email: string): Promise<string> {
  const res = await request(app)
    .post("/auth/register")
    .send({ name: "U", email, password: "hunter2" });
  return res.body.token as string;
}

describe("search routes", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/search?q=budget");
    expect(res.status).toBe(401);
  });

  it("rejects a missing or too-short query", async () => {
    const token = await registerAndToken("sq-short@example.com");

    const missing = await request(app)
      .get("/search")
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("INVALID_QUERY");

    const short = await request(app)
      .get("/search?q=%20a%20")
      .set("Authorization", `Bearer ${token}`);
    expect(short.status).toBe(400);
  });

  it("returns grouped, owner-scoped results", async () => {
    const token = await registerAndToken("sq-owner@example.com");
    await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Budget kickoff" });

    const res = await request(app)
      .get("/search?q=budget")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.query).toBe("budget");
    expect(res.body.meetings).toHaveLength(1);
    expect(res.body.meetings[0].title).toBe("Budget kickoff");
    expect(res.body.transcripts).toEqual([]);
    expect(res.body.tasks).toEqual([]);
  });
});
