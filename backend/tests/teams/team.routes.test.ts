import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/client.js";
import { createTestUser, type TestUser } from "../helpers/users.js";

const app = createApp();

let owner: TestUser;
let other: TestUser;
let sarah: TestUser;
let bob: TestUser;

beforeEach(async () => {
  owner = await createTestUser({ email: "owner@team.test", name: "Owner Olly" });
  other = await createTestUser({ email: "other@team.test", name: "Other Oz" });
  sarah = await createTestUser({ email: "sarah@team.test", name: "Sarah Kim" });
  bob = await createTestUser({ email: "bob@team.test", name: "Bob Lee" });
});

describe("team routes", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/teams")).status).toBe(401);
    expect((await request(app).post("/teams").send({ name: "X", memberIds: [] })).status).toBe(401);
  });

  it("creates a team with members and lists it with active members only", async () => {
    const created = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Launch crew", memberIds: [sarah.id, bob.id] });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Launch crew");
    expect(created.body.members.map((m: { id: string }) => m.id).sort()).toEqual(
      [sarah.id, bob.id].sort(),
    );

    const list = await request(app)
      .get("/teams")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].members).toHaveLength(2);
  });

  it("allows an empty team and rejects a blank name", async () => {
    const empty = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Solo", memberIds: [] });
    expect(empty.status).toBe(201);
    expect(empty.body.members).toEqual([]);

    const blank = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "", memberIds: [] });
    expect(blank.status).toBe(400);
  });

  it("rejects unknown and inactive member ids with INVALID_MEMBERS", async () => {
    const unknown = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Ghosts", memberIds: ["nonexistent-id"] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("INVALID_MEMBERS");

    const inactive = await createTestUser({ email: "gone@team.test", isActive: false });
    const withInactive = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Zombies", memberIds: [inactive.id] });
    expect(withInactive.status).toBe(400);
    expect(withInactive.body.error).toBe("INVALID_MEMBERS");
  });

  it("is owner-scoped: others cannot see, edit, or delete my teams", async () => {
    const created = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Private", memberIds: [] });
    const teamId = created.body.id as string;

    const list = await request(app)
      .get("/teams")
      .set("Authorization", `Bearer ${other.token}`);
    expect(list.body).toEqual([]);

    const patch = await request(app)
      .patch(`/teams/${teamId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ name: "Hijacked" });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete(`/teams/${teamId}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(del.status).toBe(404);
  });

  it("PATCH renames and REPLACES the member set", async () => {
    const created = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Old name", memberIds: [sarah.id, bob.id] });
    const teamId = created.body.id as string;

    const patched = await request(app)
      .patch(`/teams/${teamId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "New name", memberIds: [bob.id] });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe("New name");
    expect(patched.body.members.map((m: { id: string }) => m.id)).toEqual([bob.id]);

    const emptyPatch = await request(app)
      .patch(`/teams/${teamId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(emptyPatch.status).toBe(400);
  });

  it("DELETE removes the team and nulls teamId on referencing meetings", async () => {
    const created = await request(app)
      .post("/teams")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Doomed", memberIds: [] });
    const teamId = created.body.id as string;
    const meeting = await prisma.meeting.create({
      data: { ownerId: owner.id, title: "Kept", status: "ready", teamId },
    });

    const del = await request(app)
      .delete(`/teams/${teamId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(del.status).toBe(204);

    const fresh = await prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id } });
    expect(fresh.teamId).toBeNull();
    expect(fresh.title).toBe("Kept");
  });
});
