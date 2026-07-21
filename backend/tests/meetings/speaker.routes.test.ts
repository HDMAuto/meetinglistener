import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/client.js";
import { createTestUser } from "../helpers/users.js";

const app = createApp();

const SEGMENTS = [
  { speaker: "A", text: "I'll own the launch deck and circulate it on Friday.", start: 0, end: 3000 },
  { speaker: "A", text: "I'll also sync with finance about the budget.", start: 3000, end: 5000 },
  { speaker: "B", text: "Sounds good to me.", start: 5000, end: 6000 },
];

async function readyMeeting(ownerId: string, teamId?: string) {
  const meeting = await prisma.meeting.create({
    data: { ownerId, title: "Systems sync", status: "ready", teamId: teamId ?? null },
  });
  await prisma.transcript.create({
    data: { meetingId: meeting.id, fullText: "…", segments: SEGMENTS },
  });
  return meeting;
}

function speakerTask(meetingId: string, label: string | null, extra: Record<string, unknown> = {}) {
  return prisma.task.create({
    data: {
      meetingId,
      description: "Own the deck",
      assigneeText: "me",
      assigneeSpeakerLabel: label,
      status: "needs_assignee",
      suggestedAssigneeIds: [],
      ...extra,
    },
  });
}

describe("speaker routes", () => {
  it("lists every transcript speaker with quotes and candidates, owner-scoped", async () => {
    const owner = await createTestUser({ email: "o@spk.com", name: "Sarah Kim" });
    const meeting = await readyMeeting(owner.id);

    const res = await request(app)
      .get(`/meetings/${meeting.id}/speakers`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.speakers.map((s: { label: string }) => s.label)).toEqual(["A", "B"]);
    const a = res.body.speakers[0];
    expect(a.displayName).toBe("Speaker A");
    expect(a.quotes.length).toBeGreaterThan(0);
    expect(a.quotes[0]).toContain("launch deck");
    expect(res.body.candidates.some((c: { id: string }) => c.id === owner.id)).toBe(true);
  });

  it("returns 404 for a meeting you don't own", async () => {
    const owner = await createTestUser({ email: "o2@spk.com" });
    const other = await createTestUser({ email: "x2@spk.com" });
    const meeting = await readyMeeting(owner.id);

    const res = await request(app)
      .get(`/meetings/${meeting.id}/speakers`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });

  it("confirming a speaker assigns and notifies that speaker's tasks", async () => {
    const owner = await createTestUser({ email: "o3@spk.com", name: "Sarah Kim" });
    const meeting = await readyMeeting(owner.id);
    const task = await speakerTask(meeting.id, "A");

    const res = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: owner.id });

    expect(res.status).toBe(200);
    const a = res.body.speakers.find((s: { label: string }) => s.label === "A");
    expect(a).toMatchObject({ userId: owner.id, confirmed: true, displayName: "Sarah Kim" });

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.assigneeId).toBe(owner.id);
    expect(updated.status).toBe("open");

    const notifs = await prisma.notification.findMany({ where: { userId: owner.id } });
    expect(notifs).toHaveLength(1);
  });

  it("rejects labeling a speaker as someone outside the meeting's team", async () => {
    const owner = await createTestUser({ email: "o4@spk.com" });
    const member = await createTestUser({ email: "m4@spk.com", name: "Team Member" });
    const outsider = await createTestUser({ email: "out4@spk.com", name: "Outsider" });
    const team = await prisma.team.create({
      data: { ownerId: owner.id, name: "Core", members: { connect: [{ id: member.id }] } },
    });
    const meeting = await readyMeeting(owner.id, team.id);

    const rejected = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: outsider.id });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toBe("INVALID_ASSIGNEE");

    const ok = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: member.id });
    expect(ok.status).toBe(200);
  });

  it("labeling a speaker as a guest unassigns that speaker's tasks", async () => {
    const owner = await createTestUser({ email: "o5@spk.com" });
    const meeting = await readyMeeting(owner.id);
    const task = await speakerTask(meeting.id, "A", { assigneeId: owner.id, status: "open" });

    const res = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ guestName: "Jordan (client)" });

    expect(res.status).toBe(200);
    const a = res.body.speakers.find((s: { label: string }) => s.label === "A");
    expect(a).toMatchObject({ userId: null, guestName: "Jordan (client)", displayName: "Jordan (client)" });

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.assigneeId).toBeNull();
    expect(updated.status).toBe("needs_assignee");
  });

  it("clearing a speaker resets it and its tasks", async () => {
    const owner = await createTestUser({ email: "o6@spk.com" });
    const meeting = await readyMeeting(owner.id);
    await prisma.meetingSpeaker.create({
      data: { meetingId: meeting.id, label: "A", userId: owner.id, confidence: "high", confirmed: true },
    });
    const task = await speakerTask(meeting.id, "A", { assigneeId: owner.id, status: "open" });

    const res = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ clear: true });

    expect(res.status).toBe(200);
    const a = res.body.speakers.find((s: { label: string }) => s.label === "A");
    expect(a).toMatchObject({ userId: null, guestName: null, displayName: "Speaker A" });
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("needs_assignee");
  });

  it("does not touch tasks that were manually detached from the speaker", async () => {
    const owner = await createTestUser({ email: "o7@spk.com" });
    const meeting = await readyMeeting(owner.id);
    const detached = await speakerTask(meeting.id, null, { assigneeId: owner.id, status: "open" });

    await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ guestName: "Someone" });

    const still = await prisma.task.findUniqueOrThrow({ where: { id: detached.id } });
    expect(still.assigneeId).toBe(owner.id);
    expect(still.status).toBe("open");
  });

  it("rejects a body with more than one identity field", async () => {
    const owner = await createTestUser({ email: "o8@spk.com" });
    const meeting = await readyMeeting(owner.id);

    const res = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: owner.id, guestName: "Also this" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_BODY");
  });

  it("returns 404 patching a meeting you don't own", async () => {
    const owner = await createTestUser({ email: "o9@spk.com" });
    const other = await createTestUser({ email: "x9@spk.com" });
    const meeting = await readyMeeting(owner.id);

    const res = await request(app)
      .patch(`/meetings/${meeting.id}/speakers/A`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ clear: true });
    expect(res.status).toBe(404);
  });
});
