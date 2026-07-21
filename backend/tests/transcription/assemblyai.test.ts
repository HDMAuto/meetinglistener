import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { transcribeAudio } from "../../src/transcription/assemblyai.js";

describe("transcribeAudio", () => {
  beforeEach(() => {
    mkdirSync("uploads-test", { recursive: true });
    writeFileSync("uploads-test/m1.m4a", "fake-audio-bytes");
  });
  afterAll(() => rmSync("uploads-test", { recursive: true, force: true }));

  it("uploads, requests, polls, and returns speaker-labeled text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ upload_url: "http://x/aud" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "t1", status: "queued" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "t1",
          status: "completed",
          text: "Hello everyone. Let's start.",
          audio_duration: 42,
          utterances: [
            { speaker: "A", text: "Hello everyone.", start: 100, end: 1500 },
            { speaker: "B", text: "Let's start.", start: 1600, end: 2400 },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio("uploads-test/m1.m4a");
    expect(result.durationSec).toBe(42);
    expect(result.text).toContain("Hello everyone");
    expect(result.speakerLabeledText).toContain("Speaker A: Hello everyone.");
    expect(result.speakerLabeledText).toContain("Speaker B: Let's start.");
    // Per-utterance timestamps are preserved for later snippet playback / voiceprints.
    expect(result.utterances[0]).toMatchObject({ speaker: "A", start: 100, end: 1500 });
    expect(result.utterances[1]).toMatchObject({ speaker: "B", start: 1600, end: 2400 });

    vi.unstubAllGlobals();
  });

  it("throws when transcription errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ upload_url: "http://x/aud" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "t2", status: "queued" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "t2", status: "error", error: "bad audio" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeAudio("uploads-test/m1.m4a")).rejects.toThrow("bad audio");
    vi.unstubAllGlobals();
  });
});