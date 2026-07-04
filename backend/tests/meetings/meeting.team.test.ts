import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestUser, type TestUser } from "../helpers/users.js";

const app = createApp();

let owner: TestUser;
let other: TestUser;
let sarah: TestUser;

async function makeTeam(token: string, memberIds: string[]): Promise<string> {
  const res = await request(app)
    .post("/teams")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Crew", memberIds });
  return res.body.id as string;
}

beforeEach(async () => {
  owner = await createTestUser({ email: "owner@mt.test", name: "Owner Olly" });
  other = await createTestUser({ email: "other@mt.test", name: "Other Oz" });
  sarah = await createTestUser({ email: "sarah@mt.test", name: "Sarah Kim" });
});

describe("meetings with teams", () => {
  it("creates a meeting with my team and embeds it on GET /:id", async () => {
    const teamId = await makeTeam(owner.token, [sarah.id]);

    const created = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Sprint", teamId });
    expect(created.status).toBe(201);
    expect(created.body.teamId).toBe(teamId);

    const got = await request(app)
      .get(`/meetings/${created.body.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(got.status).toBe(200);
    expect(got.body.team.id).toBe(teamId);
    expect(got.body.team.name).toBe("Crew");
    expect(got.body.team.members).toEqual([{ id: sarah.id, name: "Sarah Kim" }]);
  });

  it("rejects another user's team with INVALID_TEAM", async () => {
    const teamId = await makeTeam(other.token, []);
    const res = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Sneaky", teamId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_TEAM");
  });

  it("rejects an unknown teamId with INVALID_TEAM", async () => {
    const res = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Ghost", teamId: "nonexistent" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_TEAM");
  });

  it("still creates team-less meetings, and GET /:id then has team: null", async () => {
    const created = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Plain" });
    expect(created.status).toBe(201);
    expect(created.body.teamId).toBeNull();

    const got = await request(app)
      .get(`/meetings/${created.body.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(got.body.team).toBeNull();
  });

  it("rejects an empty-string teamId with 400", async () => {
    const res = await request(app)
      .post("/meetings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Empty", teamId: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_BODY");
  });
});
