import { describe, it, expect, vi, afterAll } from "vitest";
import { rmSync } from "node:fs";

// Prevent real background processing during the upload test.
vi.mock("../../src/pipeline/processMeeting.js", () => ({ processMeeting: vi.fn() }));

import request from "supertest";
import { createApp } from "../../src/app.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { signToken } from "../../src/auth/jwt.js";

const app = createApp();

describe("audio upload route", () => {
  afterAll(() => rmSync("uploads-test", { recursive: true, force: true }));

  it("accepts an upload and marks the meeting uploaded", async () => {
    const owner = await createUser({ name: "A", email: "up@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });

    const res = await request(app)
      .post(`/meetings/${meeting.id}/audio`)
      .set("Authorization", `Bearer ${token}`)
      .attach("audio", Buffer.from("fake-bytes"), "clip.m4a");

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("uploaded");
    expect(res.body.audioUrl).toContain(meeting.id);
  });

  it("rejects an upload with no file", async () => {
    const owner = await createUser({ name: "A", email: "up2@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });

    const res = await request(app)
      .post(`/meetings/${meeting.id}/audio`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
