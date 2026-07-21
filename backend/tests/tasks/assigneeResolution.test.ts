import { describe, it, expect } from "vitest";
import {
  resolveAssignee,
  resolveViaSpeaker,
  resolveTaskAssignee,
} from "../../src/tasks/assigneeResolution.js";

const users = [
  { id: "u_sarah", name: "Sarah Kim" },
  { id: "u_chrisA", name: "Chris Doe" },
  { id: "u_chrisB", name: "Chris Payne" },
  { id: "u_bob", name: "Bob Lee" },
];

describe("resolveAssignee", () => {
  it("assigns when confident and exactly one match", () => {
    const r = resolveAssignee("Sarah", "high", users);
    expect(r.assigneeId).toBe("u_sarah");
    expect(r.status).toBe("open");
    expect(r.suggestedAssigneeIds).toEqual([]);
  });

  it("needs review when multiple people match", () => {
    const r = resolveAssignee("Chris", "high", users);
    expect(r.assigneeId).toBeNull();
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual(["u_chrisA", "u_chrisB"]);
  });

  it("needs review when confidence is low even with one match", () => {
    const r = resolveAssignee("Bob", "low", users);
    expect(r.assigneeId).toBeNull();
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual(["u_bob"]);
  });

  it("needs review with no suggestions when nobody matches", () => {
    const r = resolveAssignee("Zoltan", "high", users);
    expect(r.assigneeId).toBeNull();
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual([]);
  });
});

describe("resolveViaSpeaker", () => {
  it("auto-assigns when both the task link and the speaker identity are confident", () => {
    const r = resolveViaSpeaker("high", { userId: "u_sarah", confidence: "high" });
    expect(r).toEqual({ assigneeId: "u_sarah", suggestedAssigneeIds: [], status: "open" });
  });

  it("suggests, not assigns, when the speaker identity is only a low-confidence guess", () => {
    const r = resolveViaSpeaker("high", { userId: "u_sarah", confidence: "low" });
    expect(r.assigneeId).toBeNull();
    expect(r.suggestedAssigneeIds).toEqual(["u_sarah"]);
    expect(r.status).toBe("needs_assignee");
  });

  it("suggests, not assigns, when the task link itself is low-confidence", () => {
    const r = resolveViaSpeaker("low", { userId: "u_sarah", confidence: "high" });
    expect(r.assigneeId).toBeNull();
    expect(r.suggestedAssigneeIds).toEqual(["u_sarah"]);
  });

  it("needs review with no suggestion when the speaker is unresolved", () => {
    const r = resolveViaSpeaker("high", { userId: null, confidence: "unknown" });
    expect(r.assigneeId).toBeNull();
    expect(r.suggestedAssigneeIds).toEqual([]);
  });
});

describe("resolveTaskAssignee", () => {
  it("uses heard-name matching when the task has no speaker label", () => {
    const r = resolveTaskAssignee(
      { assignee: "Sarah", assigneeConfidence: "high", assigneeSpeakerLabel: null },
      users,
      undefined,
    );
    expect(r.assigneeId).toBe("u_sarah");
  });

  it("prefers the speaker identity for a self-referential assignee ('me')", () => {
    const r = resolveTaskAssignee(
      { assignee: "me", assigneeConfidence: "high", assigneeSpeakerLabel: "A" },
      users,
      { userId: "u_sarah", confidence: "high" },
    );
    expect(r.assigneeId).toBe("u_sarah");
    expect(r.status).toBe("open");
  });

  it("falls back to heard name when the speaker can't be identified", () => {
    const r = resolveTaskAssignee(
      { assignee: "Bob", assigneeConfidence: "high", assigneeSpeakerLabel: "C" },
      users,
      { userId: null, confidence: "unknown" },
    );
    expect(r.assigneeId).toBe("u_bob");
  });

  it("merges suggestions from speaker and name when neither auto-assigns", () => {
    const r = resolveTaskAssignee(
      { assignee: "Chris", assigneeConfidence: "high", assigneeSpeakerLabel: "A" },
      users,
      { userId: "u_sarah", confidence: "low" },
    );
    expect(r.status).toBe("needs_assignee");
    expect(r.suggestedAssigneeIds).toEqual(
      expect.arrayContaining(["u_sarah", "u_chrisA", "u_chrisB"]),
    );
  });
});