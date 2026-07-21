import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shared Anthropic client before importing the analyzer.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("../../src/ai/anthropicClient.js", () => ({
  anthropic: { messages: { create: createMock } },
}));

import { analyzeTranscript } from "../../src/ai/analyzer.js";

describe("analyzeTranscript", () => {
  beforeEach(() => createMock.mockReset());

  it("returns the structured analysis Claude produces, including speaker guesses", async () => {
    const payload = {
      goal: "Plan the Q3 launch",
      summary: "The team discussed timelines and owners.",
      speakers: [
        { label: "A", name: "Sarah", confidence: "high" },
        { label: "B", name: null, confidence: "unknown" },
      ],
      tasks: [
        {
          description: "Draft the press release",
          assignee: "Sarah",
          assigneeConfidence: "high",
          assigneeSpeakerLabel: "A",
        },
        {
          description: "Book the venue",
          assignee: "someone",
          assigneeConfidence: "unknown",
          assigneeSpeakerLabel: null,
        },
      ],
    };
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(payload) }],
    });

    const result = await analyzeTranscript("Speaker A: let's plan the launch...", ["Sarah Kim", "Bob Ndlovu"]);
    expect(result.goal).toBe("Plan the Q3 launch");
    expect(result.speakers).toHaveLength(2);
    expect(result.speakers[0]).toMatchObject({ label: "A", name: "Sarah", confidence: "high" });
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].assigneeSpeakerLabel).toBe("A");
    expect(result.tasks[1].assigneeSpeakerLabel).toBeNull();

    const arg = createMock.mock.calls[0][0];
    expect(arg.model).toBe("claude-opus-4-8");
    expect(arg.output_config.format.type).toBe("json_schema");
    // The candidate roster is injected so guesses stay on-roster.
    expect(arg.system).toContain("Sarah Kim");
    expect(arg.system).toContain("Bob Ndlovu");
  });

  it("works with no roster provided", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ goal: "g", summary: "s", speakers: [], tasks: [] }),
        },
      ],
    });
    const result = await analyzeTranscript("Speaker A: hi");
    expect(result.tasks).toHaveLength(0);
    expect(result.speakers).toHaveLength(0);
  });

  it("throws a clear error if Claude returns no text block", async () => {
    createMock.mockResolvedValue({ content: [] });
    await expect(analyzeTranscript("...", [])).rejects.toThrow("NO_ANALYSIS");
  });
});
