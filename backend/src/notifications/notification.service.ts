import { prisma } from "../db/client.js";

export async function notifyAssignee(task: {
  id: string;
  assigneeId: string | null;
  meetingId: string;
}): Promise<void> {
  if (!task.assigneeId) return;
  await prisma.notification.create({
    data: { userId: task.assigneeId, taskId: task.id, meetingId: task.meetingId },
  });
  await prisma.task.update({ where: { id: task.id }, data: { notifiedAt: new Date() } });
}