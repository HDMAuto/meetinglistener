import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestUser } from "../helpers/users.js";

const app = createApp();

async function registerAndToken(email: string): Promise<string> {
  return (await createTestUser({ email })).token;
}

describe("meeting routes", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/meetings");
    expect(res.status).toBe(401);
  });

  it("creates and lists meetings for the owner", async () => {
    const token = await registerAndToken("owner@example.com");

    const created = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Standup" });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Standup");
    expect(created.body.status).toBe("recording");

    const list = await request(app)
      .get("/meetings")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("gets a meeting by id, 404 for other users", async () => {
    const ownerToken = await registerAndToken("g-owner@example.com");
    const otherToken = await registerAndToken("g-other@example.com");

    const created = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Private" });
    const id = created.body.id as string;

    const ok = await request(app)
      .get(`/meetings/${id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);

    const forbidden = await request(app)
      .get(`/meetings/${id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(404);
  });

  it("rejects creating a meeting with no title", async () => {
    const token = await registerAndToken("notitle@example.com");
    const res = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});