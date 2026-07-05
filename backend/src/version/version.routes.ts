import { Router } from "express";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.js";
import { latestVersionFrom } from "./version.service.js";

export const versionRouter = Router();
const dir = resolve(env.DOWNLOADS_DIR);

// Public: tells clients the newest installer version on the download page.
versionRouter.get("/", (_req, res) => {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    // downloads dir may not exist — report no version available.
  }
  res.json({ latest: latestVersionFrom(names) });
});
