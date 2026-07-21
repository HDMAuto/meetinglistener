export type Confidence = "high" | "low" | "unknown";

export interface Candidate {
  id: string;
  name: string;
}

export interface Resolution {
  assigneeId: string | null;
  suggestedAssigneeIds: string[];
  status: "open" | "needs_assignee";
}

export function matches(userName: string, target: string): boolean {
  const n = userName.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!t) return false;
  const first = n.split(/\s+/)[0];
  return n === t || first === t || n.includes(t) || t.includes(first);
}

export function resolveAssignee(
  assigneeName: string,
  confidence: Confidence,
  users: Candidate[],
): Resolution {
  const found = users.filter((u) => matches(u.name, assigneeName));
  if (confidence === "high" && found.length === 1) {
    return { assigneeId: found[0].id, suggestedAssigneeIds: [], status: "open" };
  }
  return {
    assigneeId: null,
    suggestedAssigneeIds: found.map((u) => u.id),
    status: "needs_assignee",
  };
}

// Resolve a task via the speaker it was assigned to. Auto-assign only when we
// are confident on BOTH counts: Claude confidently tied the task to a speaker,
// AND that speaker's identity confidently maps to a single app user. Otherwise
// surface the mapped user (if any) as a suggestion for the owner to confirm.
export function resolveViaSpeaker(
  taskConfidence: Confidence,
  speaker: { userId: string | null; confidence: Confidence } | undefined,
): Resolution {
  if (speaker?.userId && speaker.confidence === "high" && taskConfidence === "high") {
    return { assigneeId: speaker.userId, suggestedAssigneeIds: [], status: "open" };
  }
  return {
    assigneeId: null,
    suggestedAssigneeIds: speaker?.userId ? [speaker.userId] : [],
    status: "needs_assignee",
  };
}

export interface TaskToResolve {
  assignee: string;
  assigneeConfidence: Confidence;
  assigneeSpeakerLabel: string | null;
}

// Full task resolution. Prefer the speaker the task was assigned to; if that
// doesn't confidently resolve, fall back to matching the heard assignee name
// (which also covers assignees who never spoke). Suggestions from both paths
// are merged when neither auto-assigns.
export function resolveTaskAssignee(
  task: TaskToResolve,
  candidates: Candidate[],
  speaker: { userId: string | null; confidence: Confidence } | undefined,
): Resolution {
  if (!task.assigneeSpeakerLabel) {
    return resolveAssignee(task.assignee, task.assigneeConfidence, candidates);
  }
  const viaSpeaker = resolveViaSpeaker(task.assigneeConfidence, speaker);
  if (viaSpeaker.status === "open") return viaSpeaker;
  const viaName = resolveAssignee(task.assignee, task.assigneeConfidence, candidates);
  if (viaName.status === "open") return viaName;
  const suggestedAssigneeIds = Array.from(
    new Set([...viaSpeaker.suggestedAssigneeIds, ...viaName.suggestedAssigneeIds]),
  );
  return { assigneeId: null, suggestedAssigneeIds, status: "needs_assignee" };
}
