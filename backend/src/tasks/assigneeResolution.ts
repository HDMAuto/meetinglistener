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

function matches(userName: string, target: string): boolean {
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
