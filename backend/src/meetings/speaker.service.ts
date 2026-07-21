import type { MeetingSpeaker } from "@prisma/client";
import { prisma } from "../db/client.js";
import { matches, type Candidate } from "../tasks/assigneeResolution.js";
import { notifyAssignee } from "../notifications/notification.service.js";
import type { SpeakerGuess } from "../ai/analyzer.js";
import type { Utterance } from "../transcription/assemblyai.js";

export type { Candidate };

const MAX_QUOTES = 3;
const QUOTE_MAXLEN = 160;

// The people a meeting's speakers may be labeled as: the attached team's active
// members (hard boundary), or all active users when no team is attached. This
// is the same candidate set used for task assignment.
export async function getMeetingCandidates(meetingId: string): Promise<Candidate[]> {
  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    select: { teamId: true },
  });
  return prisma.user.findMany({
    where: {
      isActive: true,
      ...(meeting.teamId ? { teams: { some: { id: meeting.teamId } } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// A guessed name maps to a user only when it unambiguously matches exactly one
// candidate; anything else stays unresolved (owner picks in the UI).
export function resolveSpeakerUser(name: string | null, candidates: Candidate[]): string | null {
  if (!name) return null;
  const found = candidates.filter((c) => matches(c.name, name));
  return found.length === 1 ? found[0].id : null;
}

// Persist Claude's per-speaker identity guesses as unconfirmed mappings. If a
// meeting is re-processed, a mapping the owner already confirmed is left
// untouched — a new machine guess must not silently overwrite a human decision.
export async function createMeetingSpeakers(
  meetingId: string,
  speakers: SpeakerGuess[],
  candidates: Candidate[],
): Promise<MeetingSpeaker[]> {
  const rows: MeetingSpeaker[] = [];
  for (const s of speakers) {
    const existing = await prisma.meetingSpeaker.findUnique({
      where: { meetingId_label: { meetingId, label: s.label } },
    });
    if (existing?.confirmed) {
      rows.push(existing);
      continue;
    }
    const userId = resolveSpeakerUser(s.name, candidates);
    const row = await prisma.meetingSpeaker.upsert({
      where: { meetingId_label: { meetingId, label: s.label } },
      create: { meetingId, label: s.label, userId, confidence: s.confidence, confirmed: false },
      update: { userId, confidence: s.confidence, confirmed: false },
    });
    rows.push(row);
  }
  return rows;
}

export interface SpeakerView {
  label: string;
  userId: string | null;
  guestName: string | null;
  displayName: string;
  confidence: string;
  confirmed: boolean;
  quotes: string[];
}

function representativeQuotes(segments: Utterance[], label: string): string[] {
  return segments
    .filter((u) => u?.speaker === label && u.text?.trim())
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, MAX_QUOTES)
    .map((u) =>
      u.text.length > QUOTE_MAXLEN ? `${u.text.slice(0, QUOTE_MAXLEN - 1).trimEnd()}…` : u.text,
    );
}

// Every speaker present in the transcript (union with any stored mapping), each
// with its resolved display name and a few representative lines, plus the set
// of users the owner may label them as.
export async function getMeetingSpeakers(
  meetingId: string,
): Promise<{ speakers: SpeakerView[]; candidates: Candidate[] }> {
  const [rows, transcript, candidates] = await Promise.all([
    prisma.meetingSpeaker.findMany({
      where: { meetingId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.transcript.findUnique({ where: { meetingId }, select: { segments: true } }),
    getMeetingCandidates(meetingId),
  ]);

  const segments = ((transcript?.segments as unknown as Utterance[] | null) ?? []).filter(
    (u) => u && typeof u.speaker === "string" && typeof u.text === "string",
  );

  // First-appearance order from the transcript, then any label-only rows.
  const labels: string[] = [];
  for (const u of segments) if (!labels.includes(u.speaker)) labels.push(u.speaker);
  for (const r of rows) if (!labels.includes(r.label)) labels.push(r.label);

  const rowByLabel = new Map(rows.map((r) => [r.label, r]));

  const speakers: SpeakerView[] = labels.map((label) => {
    const r = rowByLabel.get(label);
    const displayName = r?.user?.name ?? r?.guestName ?? `Speaker ${label}`;
    return {
      label,
      userId: r?.userId ?? null,
      guestName: r?.guestName ?? null,
      displayName,
      confidence: r?.confidence ?? "unknown",
      confirmed: r?.confirmed ?? false,
      quotes: representativeQuotes(segments, label),
    };
  });

  return { speakers, candidates };
}

// Owner sets a speaker's identity. Exactly one of userId / guestName is set (or
// neither, to clear). The mapping is marked confirmed, then every task tied to
// this speaker is re-resolved: assigned + notified when mapped to a user, or
// returned to needs_assignee when set to a guest / cleared. Tasks that were
// manually reassigned are detached (assigneeSpeakerLabel = null) and untouched.
export async function setMeetingSpeaker(
  meetingId: string,
  label: string,
  identity: { userId: string | null; guestName: string | null },
): Promise<void> {
  const { userId, guestName } = identity;
  await prisma.meetingSpeaker.upsert({
    where: { meetingId_label: { meetingId, label } },
    create: { meetingId, label, userId, guestName, confidence: "high", confirmed: true },
    update: { userId, guestName, confidence: "high", confirmed: true },
  });

  // Never disturb completed work: re-resolution only touches live tasks, so
  // correcting/clearing a speaker can't reopen a done task or re-notify.
  const tasks = await prisma.task.findMany({
    where: { meetingId, assigneeSpeakerLabel: label, status: { not: "done" } },
  });
  for (const t of tasks) {
    if (userId) {
      if (t.assigneeId !== userId) {
        await prisma.task.update({
          where: { id: t.id },
          data: { assigneeId: userId, status: "open" },
        });
        await notifyAssignee({ id: t.id, assigneeId: userId, meetingId });
      }
    } else if (t.assigneeId !== null || t.status !== "needs_assignee") {
      await prisma.task.update({
        where: { id: t.id },
        data: { assigneeId: null, status: "needs_assignee" },
      });
    }
  }
}
