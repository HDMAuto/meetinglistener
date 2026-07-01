import { describe, it, expect } from "vitest";
import { resolveAssignee } from "../../src/tasks/assigneeResolution.js";

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