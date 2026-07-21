import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { getMeeting } from "./meeting.service.js";
import { getMeetingSpeakers, getMeetingCandidates, setMeetingSpeaker } from "./speaker.service.js";
import { asyncHandler } from "../http/asyncHandler.js";

export const speakerRouter = Router();

// GET /meetings/:id/speakers — every speaker in the transcript with its
// resolved identity, representative quotes, and the users it may be labeled as.
speakerRouter.get(
  "/:id/speakers",
  requireAuth,
  asyncHandler(async (req, res) => {
    const meeting = await getMeeting(req.params.id, req.userId!);
    if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(await getMeetingSpeakers(meeting.id));
  }),
);

// PATCH /meetings/:id/speakers/:label — set a speaker to an app user, a
// free-text guest, or clear it. Exactly one field may be provided.
const patchSchema = z
  .object({
    userId: z.string().min(1).optional(),
    guestName: z.string().trim().min(1).optional(),
    clear: z.literal(true).optional(),
  })
  .refine(
    (b) => [b.userId, b.guestName, b.clear].filter((v) => v !== undefined).length === 1,
    { message: "Provide exactly one of userId, guestName, or clear." },
  );

speakerRouter.patch(
  "/:id/speakers/:label",
  requireAuth,
  asyncHandler(async (req, res) => {
    const meeting = await getMeeting(req.params.id, req.userId!);
    if (!meeting) return res.status(404).json({ error: "NOT_FOUND" });

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });

    let identity: { userId: string | null; guestName: string | null };
    if (parsed.data.userId) {
      // Enforce the team boundary: a speaker may only be labeled as one of the
      // meeting's candidate users.
      const candidates = await getMeetingCandidates(meeting.id);
      if (!candidates.some((c) => c.id === parsed.data.userId)) {
        return res.status(400).json({ error: "INVALID_ASSIGNEE" });
      }
      identity = { userId: parsed.data.userId, guestName: null };
    } else if (parsed.data.guestName) {
      identity = { userId: null, guestName: parsed.data.guestName };
    } else {
      identity = { userId: null, guestName: null };
    }

    await setMeetingSpeaker(meeting.id, req.params.label, identity);
    return res.json(await getMeetingSpeakers(meeting.id));
  }),
);
