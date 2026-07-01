import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { saveAudio, getAudioAbsolutePath } from "../../src/storage/audioStorage.js";

describe("audioStorage", () => {
  afterAll(() => {
    rmSync("uploads-test", { recursive: true, force: true });
  });

  it("saves a buffer and returns a path that reads back", async () => {
    const stored = await saveAudio("meeting_abc", Buffer.from("hello-audio"), "clip.m4a");
    expect(stored).toContain("meeting_abc");
    expect(stored.endsWith(".m4a")).toBe(true);

    const abs = getAudioAbsolutePath(stored);
    expect(readFileSync(abs, "utf8")).toBe("hello-audio");
  });

  it("defaults the extension when the original name has none", async () => {
    const stored = await saveAudio("meeting_noext", Buffer.from("x"), "recording");
    expect(stored.endsWith(".bin")).toBe(true);
  });
});