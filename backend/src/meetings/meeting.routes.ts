import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { createMeeting, listMeetings, getMeeting } from "./meeting.service.js";

export const meetingRouter = Router();

meetingRouter.use(requireAuth);

const createSchema = z.object({ title: z.string().min(1) });

meetingRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const meeting = await createMeeting({ ownerId: req.userId!, title: parsed.data.title });
  return res.status(201).json(meeting);
});

meetingRouter.get("/", async (req, res) => {
  const meetings = await listMeetings(req.userId!);
  return res.json(meetings);
});

meetingRouter.get("/:id", async (req, res) => {
  const meeting = await getMeeting(req.params.id, req.userId!);
  if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(meeting);
});