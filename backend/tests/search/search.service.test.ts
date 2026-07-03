import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/db/client.js";
import {
  search,
  HIGHLIGHT_START,
  HIGHLIGHT_END,
} from "../../src/search/search.service.js";

let ownerId: string;
let otherId: string;

beforeEach(async () => {
  const owner = await prisma.user.create({
    data: { name: "Owner", email: "owner@search.test", passwordHash: "x" },
  });
  const other = await prisma.user.create({
    data: { name: "Other", email: "other@search.test", passwordHash: "x" },
  });
  ownerId = owner.id;
  otherId = other.id;
});

function seedMeeting(
  userId: string,
  data: { title: string; goal?: string; summary?: string },
) {
  return prisma.meeting.create({
    data: { ownerId: userId, status: "ready", ...data },
  });
}

describe("search service", () => {
  it("matches meetings and ranks title hits above summary hits", async () => {
    const titleHit = await seedMeeting(ownerId, { title: "Budget review" });
    const summaryHit = await seedMeeting(ownerId, {
      title: "Weekly sync",
      summary: "We discussed the budget at length.",
    });

    const results = await search(ownerId, "budget");

    expect(results.meetings.map((m) => m.id)).toEqual([titleHit.id, summaryHit.id]);
    expect(results.meetings[0].rank).toBeGreaterThan(results.meetings[1].rank);
  });

  it("finds stemmed matches in transcripts and returns sentinel-highlighted snippets", async () => {
    const meeting = await seedMeeting(ownerId, { title: "Infra sync" });
    await prisma.transcript.create({
      data: {
        meetingId: meeting.id,
        fullText: "Speaker A: We are deploying the new server to staging tomorrow.",
      },
    });

    const results = await search(ownerId, "deploy");

    expect(results.transcripts).toHaveLength(1);
    expect(results.transcripts[0].meetingId).toBe(meeting.id);
    expect(results.transcripts[0].meetingTitle).toBe("Infra sync");
    expect(results.transcripts[0].snippet).toContain(
      `${HIGHLIGHT_START}deploying${HIGHLIGHT_END}`,
    );
  });

  it("matches tasks and includes the assignee name", async () => {
    const assignee = await prisma.user.create({
      data: { name: "Dana", email: "dana@search.test", passwordHash: "x" },
    });
    const meeting = await seedMeeting(ownerId, { title: "Planning" });
    await prisma.task.create({
      data: {
        meetingId: meeting.id,
        description: "Update the onboarding checklist",
        status: "open",
        assigneeId: assignee.id,
      },
    });

    const results = await search(ownerId, "onboarding");

    expect(results.tasks).toHaveLength(1);
    expect(results.tasks[0].meetingTitle).toBe("Planning");
    expect(results.tasks[0].assigneeName).toBe("Dana");
    expect(results.tasks[0].status).toBe("open");
  });

  it("never returns another user's data", async () => {
    const theirs = await seedMeeting(otherId, { title: "Secret budget plan" });
    await prisma.transcript.create({
      data: { meetingId: theirs.id, fullText: "budget budget budget" },
    });
    await prisma.task.create({
      data: { meetingId: theirs.id, description: "budget follow-up" },
    });

    const results = await search(ownerId, "budget");

    expect(results.meetings).toHaveLength(0);
    expect(results.transcripts).toHaveLength(0);
    expect(results.tasks).toHaveLength(0);
  });

  it("returns empty groups for a stopword-only query", async () => {
    await seedMeeting(ownerId, { title: "The of and meeting" });

    const results = await search(ownerId, "the of");

    expect(results.meetings).toHaveLength(0);
    expect(results.transcripts).toHaveLength(0);
    expect(results.tasks).toHaveLength(0);
  });

  it("caps each group at 5 results", async () => {
    for (let i = 0; i < 7; i++) {
      await seedMeeting(ownerId, { title: `Planning session ${i}` });
    }

    const results = await search(ownerId, "planning");

    expect(results.meetings).toHaveLength(5);
  });
});
