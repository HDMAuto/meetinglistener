import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mocks at the hoisted level so the vi.mock factories can reference them.
const { transcribeMock, analyzeMock } = vi.hoisted(() => ({
  transcribeMock: vi.fn(),
  analyzeMock: vi.fn(),
}));
vi.mock("../../src/transcription/assemblyai.js", () => ({ transcribeAudio: transcribeMock }));
vi.mock("../../src/ai/analyzer.js", () => ({ analyzeTranscript: analyzeMock }));

import { prisma } from "../../src/db/client.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { processMeeting } from "../../src/pipeline/processMeeting.js";

async function meetingWithAudio() {
  const owner = await createUser({ name: "Sarah Kim", email: "s@x.com", password: "hunter2" });
  const m = await createMeeting({ ownerId: owner.id, title: "Launch" });
  await prisma.meeting.update({ where: { id: m.id }, data: { audioUrl: "uploads-test/m.m4a" } });
  return { owner, meetingId: m.id };
}

describe("processMeeting", () => {
  beforeEach(() => {
    transcribeMock.mockReset();
    analyzeMock.mockReset();
  });

  it("runs the pipeline to ready and stores results", async () => {
    const { owner, meetingId } = await meetingWithAudio();
    transcribeMock.mockResolvedValue({
      text: "full text",
      speakerLabeledText: "Speaker A: hi",
      utterances: [{ speaker: "A", text: "hi" }],
      durationSec: 30,
    });
    analyzeMock.mockResolvedValue({
      goal: "Plan launch",
      summary: "Summary here",
      tasks: [{ description: "Draft PR", assignee: "Sarah", assigneeConfidence: "high" }],
    });

    await processMeeting(meetingId);

    const m = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(m.status).toBe("ready");
    expect(m.goal).toBe("Plan launch");
    expect(m.durationSec).toBe(30);

    const transcript = await prisma.transcript.findUnique({ where: { meetingId } });
    expect(transcript?.fullText).toBe("full text");

    const tasks = await prisma.task.findMany({ where: { meetingId } });
    expect(tasks[0].assigneeId).toBe(owner.id);
  });

  it("marks the meeting failed on a transcription error", async () => {
    const { meetingId } = await meetingWithAudio();
    transcribeMock.mockRejectedValue(new Error("bad audio"));

    await processMeeting(meetingId);

    const m = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(m.status).toBe("failed");
    expect(m.errorMessage).toContain("bad audio");
  });
});
