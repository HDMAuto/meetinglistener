import { anthropic } from "./anthropicClient.js";

export type Confidence = "high" | "low" | "unknown";

export interface AnalyzedTask {
  description: string;
  assignee: string;
  assigneeConfidence: Confidence;
  // Label of the speaker this task is assigned TO, when that person spoke in
  // the meeting (self-assignment, or a named participant). Null when the
  // assignee is not one of the meeting's speakers.
  assigneeSpeakerLabel: string | null;
}

export interface SpeakerGuess {
  label: string; // diarization label as heard: "A", "B", ...
  name: string | null; // best-guess real name, or null when unclear
  confidence: Confidence;
}

export interface Analysis {
  goal: string;
  summary: string;
  speakers: SpeakerGuess[];
  tasks: AnalyzedTask[];
}

const SCHEMA = {
  type: "object",
  properties: {
    goal: { type: "string" },
    summary: { type: "string" },
    speakers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          name: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["high", "low", "unknown"] },
        },
        required: ["label", "name", "confidence"],
        additionalProperties: false,
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          assignee: { type: "string" },
          assigneeConfidence: { type: "string", enum: ["high", "low", "unknown"] },
          assigneeSpeakerLabel: { type: ["string", "null"] },
        },
        required: ["description", "assignee", "assigneeConfidence", "assigneeSpeakerLabel"],
        additionalProperties: false,
      },
    },
  },
  required: ["goal", "summary", "speakers", "tasks"],
  additionalProperties: false,
} as const;

const SYSTEM = `You analyze meeting transcripts. The transcript is labeled with anonymous
speaker labels ("Speaker A", "Speaker B", ...) assigned by acoustic clustering — they are
NOT real identities. Return:
- goal: one sentence stating what the meeting was trying to achieve.
- summary: a few short paragraphs covering the key topics discussed.
- speakers: for EACH distinct speaker label in the transcript, your best guess of who they
  really are. Give the label (e.g. "A"), a name, and confidence: "high" if the transcript
  clearly reveals who the speaker is (they introduce themselves, are addressed by name, or
  their role makes it unambiguous), "low" if it is implied, "unknown" if you cannot tell.
  Set name to null when confidence is "unknown". Prefer names from the known-participants
  list below and use their exact spelling.
- tasks: action items assigned during the meeting. For each task give:
  - assignee: the responsible person's name exactly as heard.
  - assigneeConfidence: "high" if the transcript clearly names who is responsible, "low" if
    implied or ambiguous, "unknown" if no owner was stated.
  - assigneeSpeakerLabel: the speaker LABEL of the person the task is assigned to, IF that
    person is one of the speakers in this meeting — e.g. a self-assignment ("I'll take it")
    is the label of whoever said it; "Sarah, can you..." is Sarah's label if Sarah speaks in
    the meeting. Set to null if the assignee is not one of the meeting's speakers, or you are
    unsure which speaker they are.
If there are no action items, return an empty tasks array.`;

export async function analyzeTranscript(
  speakerLabeledText: string,
  roster: string[] = [],
): Promise<Analysis> {
  const rosterBlock = roster.length
    ? `\n\nKnown participants (match speaker names and assignees to this list when they fit,` +
      ` using these exact spellings):\n${roster.map((n) => `- ${n}`).join("\n")}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    system: SYSTEM + rosterBlock,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: speakerLabeledText }],
  });

  const textBlock = response.content.find((b: { type: string }) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  if (!textBlock) throw new Error("NO_ANALYSIS");

  return JSON.parse(textBlock.text) as Analysis;
}
