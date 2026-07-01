import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createUser } from "../src/users/user.service.js";
import { createMeeting } from "../src/meetings/meeting.service.js";
import { saveTranscript } from "../src/meetings/transcript.service.js";
import { signToken } from "../src/auth/jwt.js";

const app = createApp();

describe("users + transcript routes", () => {
  it("GET /users lists app users (auth required)", async () => {
    await createUser({ name: "Sarah Kim", email: "s@x.com", password: "hunter2" });
    const bob = await createUser({ name: "Bob Lee", email: "b@x.com", password: "hunter2" });
    const token = signToken({ userId: bob.id });

    const noauth = await request(app).get("/users");
    expect(noauth.status).toBe(401);

    const res = await request(app).get("/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((u: { name: string }) => u.name)).toContain("Sarah Kim");
    expect(res.body[0].passwordHash).toBeUndefined();
  });

  it("GET /meetings/:id/transcript returns the transcript for the owner", async () => {
    const owner = await createUser({ name: "Ada", email: "ada@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });

    const missing = await request(app)
      .get(`/meetings/${meeting.id}/transcript`)
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);

    await saveTranscript(meeting.id, "Hello everyone, let's begin.", [{ speaker: "A", text: "Hello" }]);

    const res = await request(app)
      .get(`/meetings/${meeting.id}/transcript`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fullText).toContain("Hello everyone");
  });

  it("GET /meetings/:id/transcript is 404 for a non-owner", async () => {
    const owner = await createUser({ name: "Ada", email: "ada2@x.com", password: "hunter2" });
    const other = await createUser({ name: "Zed", email: "zed@x.com", password: "hunter2" });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Private" });
    await saveTranscript(meeting.id, "secret", null);

    const res = await request(app)
      .get(`/meetings/${meeting.id}/transcript`)
      .set("Authorization", `Bearer ${signToken({ userId: other.id })}`);
    expect(res.status).toBe(404);
  });
});
