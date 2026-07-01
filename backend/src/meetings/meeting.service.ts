import type { Meeting } from "@prisma/client";
import { prisma } from "../db/client.js";

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