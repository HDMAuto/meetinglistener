import type { Task } from "@prisma/client";
import { prisma } from "../db/client.js";
import { resolveTaskAssignee, type Confidence } from "./assigneeResolution.js";
import { getMeetingCandidates } from "../meetings/speaker.service.js";
import { notifyAssignee } from "../notifications/notification.service.js";
import type { Analysis } from "../ai/analyzer.js";

export async function createTasksFromAnalysis(
  meetingId: string,
  analysis: Analysis,
): Promise<void> {
  // Candidates (team members, or all active users) plus any speaker mappings
  // already persisted for this meeting drive assignment. Speaker rows are
  // absent → tasks fall back to heard-name matching (prior behavior).
  const candidates = await getMeetingCandidates(meetingId);
  const speakerRows = await prisma.meetingSpeaker.findMany({ where: { meetingId } });
  const speakerByLabel = new Map(
    speakerRows.map((s) => [s.label, { userId: s.userId, confidence: s.confidence as Confidence }]),
  );

  for (const t of analysis.tasks) {
    const assigneeSpeakerLabel = t.assigneeSpeakerLabel ?? null;
    const speaker = assigneeSpeakerLabel ? speakerByLabel.get(assigneeSpeakerLabel) : undefined;
    const r = resolveTaskAssignee(
      { assignee: t.assignee, assigneeConfidence: t.assigneeConfidence, assigneeSpeakerLabel },
      candidates,
      speaker,
    );
    const task = await prisma.task.create({
      data: {
        meetingId,
        description: t.description,
        assigneeText: t.assignee,
        assigneeSpeakerLabel,
        assigneeId: r.assigneeId,
        suggestedAssigneeIds: r.suggestedAssigneeIds,
        status: r.status,
      },
    });
    if (r.assigneeId) {
      await notifyAssignee({ id: task.id, assigneeId: r.assigneeId, meetingId });
    }
  }
}

export async function listMeetingTasks(meetingId: string): Promise<Task[]> {
  return prisma.task.findMany({ where: { meetingId }, orderBy: { createdAt: "asc" } });
}

export async function assignTask(taskId: string, assigneeId: string): Promise<Task> {
  // Manual assignment wins: detach from the speaker so a later speaker
  // confirm/correct won't overwrite this deliberate choice.
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId, status: "open", assigneeSpeakerLabel: null },
  });
  await notifyAssignee({ id: task.id, assigneeId, meetingId: task.meetingId });
  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
}

export async function completeTask(taskId: string): Promise<Task> {
  return prisma.task.update({ where: { id: taskId }, data: { status: "done" } });
}