import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shared Anthropic client before importing the analyzer.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("../../src/ai/anthropicClient.js", () => ({
  anthropic: { messages: { create: createMock } },
}));

import { analyzeTranscript } from "../../src/ai/analyzer.js";

describe("analyzeTranscript", () => {
  beforeEach(() => createMock.mockReset());

  it("returns the structured analysis Claude produces", async () => {
    const payload = {
      goal: "Plan the Q3 launch",
      summary: "The team discussed timelines and owners.",
      tasks: [
        { description: "Draft the press release", assignee: "Sarah", assigneeConfidence: "high" },
        { description: "Book the venue", assignee: "someone", assigneeConfidence: "unknown" },
      ],
    };
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(payload) }],
    });

    const result = await analyzeTranscript("Speaker A: let's plan the launch...");
    expect(result.goal).toBe("Plan the Q3 launch");
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1].assigneeConfidence).toBe("unknown");

    const arg = createMock.mock.calls[0][0];
    expect(arg.model).toBe("claude-opus-4-8");
    expect(arg.output_config.format.type).toBe("json_schema");
  });

  it("throws a clear error if Claude returns no text block", async () => {
    createMock.mockResolvedValue({ content: [] });
    await expect(analyzeTranscript("...")).rejects.toThrow("NO_ANALYSIS");
  });
});