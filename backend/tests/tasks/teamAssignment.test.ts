import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createTestUser, type TestUser } from "../helpers/users.js";
import { createTasksFromAnalysis } from "../../src/tasks/task.service.js";
import type { Analysis } from "../../src/ai/analyzer.js";

let owner: TestUser;
let sarah: TestUser;
let dana: TestUser;

function analysisWith(assignee: string, confidence: "high" | "low" | "unknown"): Analysis {
  return {
    goal: "g",
    summary: "s",
    tasks: [{ description: "Do the thing", assignee, assigneeConfidence: confidence }],
  };
}

async function makeMeeting(teamId?: string): Promise<string> {
  const meeting = await prisma.meeting.create({
    data: { ownerId: owner.id, title: "M", status: "summarizing", teamId: teamId ?? null },
  });
  return meeting.id;
}

async function makeTeam(memberIds: string[]): Promise<string> {
  const team = await prisma.team.create({
    data: {
      ownerId: owner.id,
      name: "Crew",
      members: { connect: memberIds.map((id) => ({ id })) },
    },
  });
  return team.id;
}

beforeEach(async () => {
  owner = await createTestUser({ email: "owner@ta.test", name: "Owner Olly" });
  sarah = await createTestUser({ email: "sarah@ta.test", name: "Sarah Kim" });
  dana = await createTestUser({ email: "dana@ta.test", name: "Dana Cruz" });
});

describe("team-scoped auto-assignment", () => {
  it("auto-assigns a confident team-member match and notifies them", async () => {
    const teamId = await makeTeam([sarah.id]);
    const meetingId = await makeMeeting(teamId);

    await createTasksFromAnalysis(meetingId, analysisWith("Sarah", "high"));

    const task = await prisma.task.findFirstOrThrow({ where: { meetingId } });
    expect(task.assigneeId).toBe(sarah.id);
    expect(task.status).toBe("open");
    const note = await prisma.notification.findFirst({ where: { taskId: task.id } });
    expect(note?.userId).toBe(sarah.id);
  });

  it("never auto-assigns a confident NON-team name (the Dana case)", async () => {
    const teamId = await makeTeam([sarah.id]);
    const meetingId = await makeMeeting(teamId);

    await createTasksFromAnalysis(meetingId, analysisWith("Dana", "high"));

    const task = await prisma.task.findFirstOrThrow({ where: { meetingId } });
    expect(task.assigneeId).toBeNull();
    expect(task.status).toBe("needs_assignee");
    expect(task.assigneeText).toBe("Dana");
    expect(task.suggestedAssigneeIds).toEqual([]);
  });

  it("suggestions for ambiguous names contain team members only", async () => {
    const teamId = await makeTeam([sarah.id]);
    const meetingId = await makeMeeting(teamId);

    await createTasksFromAnalysis(meetingId, analysisWith("Sarah", "low"));

    const task = await prisma.task.findFirstOrThrow({ where: { meetingId } });
    expect(task.status).toBe("needs_assignee");
    expect(task.suggestedAssigneeIds).toEqual([sarah.id]);
  });

  it("meetings without a team still match against all active users", async () => {
    const meetingId = await makeMeeting();

    await createTasksFromAnalysis(meetingId, analysisWith("Dana", "high"));

    const task = await prisma.task.findFirstOrThrow({ where: { meetingId } });
    expect(task.assigneeId).toBe(dana.id);
    expect(task.status).toBe("open");
  });

  it("a deactivated team member is never auto-assigned", async () => {
    const teamId = await makeTeam([sarah.id]);
    await prisma.user.update({ where: { id: sarah.id }, data: { isActive: false } });
    const meetingId = await makeMeeting(teamId);

    await createTasksFromAnalysis(meetingId, analysisWith("Sarah", "high"));

    const task = await prisma.task.findFirstOrThrow({ where: { meetingId } });
    expect(task.assigneeId).toBeNull();
    expect(task.status).toBe("needs_assignee");
  });

  it("a team with zero active members flags every task for review", async () => {
    const teamId = await makeTeam([sarah.id]);
    await prisma.user.update({ where: { id: sarah.id }, data: { isActive: false } });
    const meetingId = await makeMeeting(teamId);

    await createTasksFromAnalysis(meetingId, analysisWith("Sarah", "high"));

    const task = await prisma.task.findFirstOrThrow({ where: { meetingId } });
    expect(task.assigneeId).toBeNull();
    expect(task.status).toBe("needs_assignee");
  });
});
