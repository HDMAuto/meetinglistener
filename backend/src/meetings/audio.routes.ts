import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/middleware.js";
import { getMeeting } from "./meeting.service.js";
import { saveAudio } from "../storage/audioStorage.js";
import { prisma } from "../db/client.js";
import { processMeeting } from "../pipeline/processMeeting.js";

export const audioRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

audioRouter.post("/:id/audio", requireAuth, upload.single("audio"), async (req, res) => {
  const meeting = await getMeeting(req.params.id, req.userId!);
  if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });

  const storedPath = await saveAudio(meeting.id, req.file.buffer, req.file.originalname);
  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { audioUrl: storedPath, status: "uploaded", errorMessage: null },
  });

  // Fire-and-forget background processing.
  void processMeeting(meeting.id);

  return res.status(202).json(updated);
});
