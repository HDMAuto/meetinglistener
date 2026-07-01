import { anthropic } from "./anthropicClient.js";

export interface AnalyzedTask {
  description: string;
  assignee: string;
  assigneeConfidence: "high" | "low" | "unknown";
}

export interface Analysis {
  goal: string;
  summary: string;
  tasks: AnalyzedTask[];
}

const SCHEMA = {
  type: "object",
  properties: {
    goal: { type: "string" },
    summary: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          assignee: { type: "string" },
          assigneeConfidence: { type: "string", enum: ["high", "low", "unknown"] },
        },
        required: ["description", "assignee", "assigneeConfidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["goal", "summary", "tasks"],
  additionalProperties: false,
} as const;

const SYSTEM = `You analyze meeting transcripts. Return:
- goal: one sentence stating what the meeting was trying to achieve.
- summary: a few short paragraphs covering the key topics discussed.
- tasks: action items assigned during the meeting. For each task, give the assignee's
  name exactly as heard, and assigneeConfidence: "high" if the transcript clearly names
  who is responsible, "low" if it is implied or ambiguous, "unknown" if no owner was stated.
If there are no action items, return an empty tasks array.`;

export async function analyzeTranscript(speakerLabeledText: string): Promise<Analysis> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: speakerLabeledText }],
  });

  const textBlock = response.content.find((b: { type: string }) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  if (!textBlock) throw new Error("NO_ANALYSIS");

  return JSON.parse(textBlock.text) as Analysis;
}