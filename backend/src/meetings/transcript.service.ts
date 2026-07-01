import { prisma } from "../db/client.js";

export async function saveTranscript(
  meetingId: string,
  fullText: string,
  segments: unknown,
): Promise<void> {
  await prisma.transcript.upsert({
    where: { meetingId },
    create: { meetingId, fullText, segments: segments as object },
    update: { fullText, segments: segments as object },
  });
}