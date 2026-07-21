import { readFile } from "node:fs/promises";
import { env } from "../config/env.js";
import { getAudioAbsolutePath } from "../storage/audioStorage.js";

const BASE = "https://api.assemblyai.com/v2";

export interface Utterance {
  speaker: string;
  text: string;
  start: number; // ms offset into the recording (from AssemblyAI)
  end: number; // ms
}

export interface TranscriptionResult {
  text: string;
  speakerLabeledText: string;
  utterances: Utterance[];
  durationSec: number;
}

function headers() {
  return { authorization: env.ASSEMBLYAI_API_KEY ?? "" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function transcribeAudio(storedPath: string): Promise<TranscriptionResult> {
  const bytes = await readFile(getAudioAbsolutePath(storedPath));

  // 1. Upload the audio bytes.
  const uploadRes = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: headers(),
    body: bytes,
  });
  if (!uploadRes.ok) throw new Error("ASSEMBLYAI_UPLOAD_FAILED");
  const { upload_url } = (await uploadRes.json()) as { upload_url: string };

  // 2. Request a transcript with speaker labels.
  const createRes = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, speaker_labels: true }),
  });
  if (!createRes.ok) throw new Error("ASSEMBLYAI_CREATE_FAILED");
  const created = (await createRes.json()) as { id: string };

  // 3. Poll until completed or error.
  for (;;) {
    const pollRes = await fetch(`${BASE}/transcript/${created.id}`, { headers: headers() });
    if (!pollRes.ok) throw new Error("ASSEMBLYAI_POLL_FAILED");
    const t = (await pollRes.json()) as {
      status: string;
      text?: string;
      error?: string;
      audio_duration?: number;
      utterances?: Array<{ speaker: string; text: string; start?: number; end?: number }>;
    };

    if (t.status === "completed") {
      const utterances: Utterance[] = (t.utterances ?? []).map((u) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start ?? 0,
        end: u.end ?? 0,
      }));
      const speakerLabeledText = utterances.length
        ? utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n")
        : (t.text ?? "");
      return {
        text: t.text ?? "",
        speakerLabeledText,
        utterances,
        durationSec: Math.round(t.audio_duration ?? 0),
      };
    }
    if (t.status === "error") throw new Error(t.error ?? "ASSEMBLYAI_ERROR");
    await sleep(3000);
  }
}