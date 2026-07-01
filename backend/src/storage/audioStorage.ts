import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { env } from "../config/env.js";

export async function saveAudio(
  meetingId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  const ext = extname(originalName) || ".bin";
  const storedPath = join(env.UPLOAD_DIR, `${meetingId}${ext}`);
  await writeFile(storedPath, buffer);
  return storedPath;
}

export function getAudioAbsolutePath(storedPath: string): string {
  return resolve(storedPath);
}