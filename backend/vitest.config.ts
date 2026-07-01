import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

function loadEnvTest(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(new URL("./.env.test", import.meta.url), "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (match) env[match[1]] = match[2];
    }
  } catch {
    // no .env.test present — fall back to process env
  }
  return env;
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: loadEnvTest(),
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/per-test.ts"],
    fileParallelism: false,
  },
});