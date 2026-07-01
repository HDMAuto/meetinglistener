import type { Meeting } from "@prisma/client";
import { prisma } from "../db/client.js";
import { deleteAudio } from "../storage/audioStorage.js";

export async function createMeeting(input: {
  ownerId: string;
  title: string;
}): Promise<Meeting> {
  return prisma.meeting.create({
    data: { ownerId: input.ownerId, title: input.title },
  });
}

export async function listMeetings(ownerId: string): Promise<Meeting[]> {
  return prisma.meeting.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMeeting(id: string, ownerId: string): Promise<Meeting | null> {
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting || meeting.ownerId !== ownerId) return null;
  return meeting;
}

// Deletes a meeting the user owns, plus its audio file and related notifications.
// Transcript and tasks are removed automatically via onDelete: Cascade.
// Returns false if the meeting doesn't exist or isn't owned by the user.
export async function deleteMeeting(id: string, ownerId: string): Promise<boolean> {
  const meeting = await getMeeting(id, ownerId);
  if (!meeting) return false;

  if (meeting.audioUrl) {
    await deleteAudio(meeting.audioUrl).catch(() => {});
  }
  await prisma.notification.deleteMany({ where: { meetingId: id } });
  await prisma.meeting.delete({ where: { id } });
  return true;
}