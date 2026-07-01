import { prisma } from "../db/client.js";
import { transcribeAudio } from "../transcription/assemblyai.js";
import { analyzeTranscript } from "../ai/analyzer.js";
import { saveTranscript } from "../meetings/transcript.service.js";
import { createTasksFromAnalysis } from "../tasks/task.service.js";

export async function processMeeting(meetingId: string): Promise<void> {
  try {
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    if (!meeting.audioUrl) throw new Error("NO_AUDIO");

    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "transcribing" } });
    const transcription = await transcribeAudio(meeting.audioUrl);
    await saveTranscript(meetingId, transcription.text, transcription.utterances);

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "summarizing", durationSec: transcription.durationSec },
    });
    const analysis = await analyzeTranscript(transcription.speakerLabeledText);
    await createTasksFromAnalysis(meetingId, analysis);

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "ready", goal: analysis.goal, summary: analysis.summary },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "failed", errorMessage: message },
    });
  }
}
