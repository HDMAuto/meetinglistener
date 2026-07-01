import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function loadEnvTest(): Record<string, string> {
  const env: Record<string, string> = {};
  const content = readFileSync(new URL("../../.env.test", import.meta.url), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

// Create/reset the test database schema once before the whole test run.
export default async function globalSetup() {
  const envTest = loadEnvTest();
  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, ...envTest },
  });
}