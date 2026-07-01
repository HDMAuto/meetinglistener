import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/client.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { saveTranscript } from "../../src/meetings/transcript.service.js";
import { createTasksFromAnalysis } from "../../src/tasks/task.service.js";
import { signToken } from "../../src/auth/jwt.js";

const app = createApp();

async function seedFullMeeting(ownerName: string, email: string) {
  const owner = await createUser({ name: ownerName, email, password: "hunter2" });
  const meeting = await createMeeting({ ownerId: owner.id, title: "To delete" });
  await saveTranscript(meeting.id, "some transcript text", [{ speaker: "A", text: "hi" }]);
  await createTasksFromAnalysis(meeting.id, {
    goal: "g",
    summary: "s",
    // assignee matches the owner's name -> auto-assigned -> creates a notification
    tasks: [{ description: "do a thing", assignee: ownerName, assigneeConfidence: "high" }],
  });
  return { owner, meeting };
}

describe("DELETE /meetings/:id", () => {
  it("deletes the meeting and cascades transcript, tasks, and notifications", async () => {
    const { owner, meeting } = await seedFullMeeting("Ada Owner", "del1@x.com");
    const token = signToken({ userId: owner.id });

    // Preconditions: children exist
    expect(await prisma.transcript.findUnique({ where: { meetingId: meeting.id } })).not.toBeNull();
    expect(await prisma.task.count({ where: { meetingId: meeting.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { meetingId: meeting.id } })).toBe(1);

    const res = await request(app)
      .delete(`/meetings/${meeting.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    expect(await prisma.meeting.findUnique({ where: { id: meeting.id } })).toBeNull();
    expect(await prisma.transcript.findUnique({ where: { meetingId: meeting.id } })).toBeNull();
    expect(await prisma.task.count({ where: { meetingId: meeting.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { meetingId: meeting.id } })).toBe(0);
  });

  it("returns 404 when deleting a meeting you don't own", async () => {
    const { meeting } = await seedFullMeeting("Ada", "del2@x.com");
    const other = await createUser({ name: "Zed", email: "zed-del@x.com", password: "hunter2" });

    const res = await request(app)
      .delete(`/meetings/${meeting.id}`)
      .set("Authorization", `Bearer ${signToken({ userId: other.id })}`);
    expect(res.status).toBe(404);

    // Still there — a non-owner can't delete it.
    expect(await prisma.meeting.findUnique({ where: { id: meeting.id } })).not.toBeNull();
  });

  it("returns 404 for a missing meeting and 401 without auth", async () => {
    const owner = await createUser({ name: "A", email: "del3@x.com", password: "hunter2" });
    const missing = await request(app)
      .delete("/meetings/nope")
      .set("Authorization", `Bearer ${signToken({ userId: owner.id })}`);
    expect(missing.status).toBe(404);

    const noauth = await request(app).delete("/meetings/anything");
    expect(noauth.status).toBe(401);
  });
});
