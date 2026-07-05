import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { getMeeting } from "../meetings/meeting.service.js";
import { prisma } from "../db/client.js";
import { listMeetingTasks, assignTask, completeTask } from "./task.service.js";
import { asyncHandler } from "../http/asyncHandler.js";

export const meetingTaskRouter = Router({ mergeParams: true });
export const taskRouter = Router();

// GET /meetings/:id/tasks
meetingTaskRouter.get("/:id/tasks", requireAuth, asyncHandler(async (req, res) => {
  const meeting = await getMeeting(req.params.id, req.userId!);
  if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(await listMeetingTasks(meeting.id));
}));

async function ownsTask(taskId: string, userId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { meeting: true } });
  return !!task && task.meeting.ownerId === userId;
}

const assignSchema = z.object({ assigneeId: z.string().min(1) });

taskRouter.post("/:id/assign", requireAuth, asyncHandler(async (req, res) => {
  if (!(await ownsTask(req.params.id, req.userId!))) return res.status(404).json({ error: "NOT_FOUND" });
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  return res.json(await assignTask(req.params.id, parsed.data.assigneeId));
}));

taskRouter.post("/:id/complete", requireAuth, asyncHandler(async (req, res) => {
  if (!(await ownsTask(req.params.id, req.userId!))) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(await completeTask(req.params.id));
}));
