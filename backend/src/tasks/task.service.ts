import type { Task } from "@prisma/client";
import { prisma } from "../db/client.js";
import { resolveAssignee } from "./assigneeResolution.js";
import { notifyAssignee } from "../notifications/notification.service.js";
import type { Analysis } from "../ai/analyzer.js";

export async function createTasksFromAnalysis(
  meetingId: string,
  analysis: Analysis,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  for (const t of analysis.tasks) {
    const r = resolveAssignee(t.assignee, t.assigneeConfidence, users);
    const task = await prisma.task.create({
      data: {
        meetingId,
        description: t.description,
        assigneeText: t.assignee,
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
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId, status: "open" },
  });
  await notifyAssignee({ id: task.id, assigneeId, meetingId: task.meetingId });
  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
}

export async function completeTask(taskId: string): Promise<Task> {
  return prisma.task.update({ where: { id: taskId }, data: { status: "done" } });
}