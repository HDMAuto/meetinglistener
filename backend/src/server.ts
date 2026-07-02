import { createApp } from "./app.js";
import { env } from "./config/env.js";

// Fail fast in production if secrets look like the dev defaults.
if (env.NODE_ENV === "production") {
  const weak =
    env.JWT_SECRET.length < 24 || /change-me|dev-secret|test-secret/i.test(env.JWT_SECRET);
  if (weak) {
    console.error(
      "Refusing to start: JWT_SECRET is weak or a default. Set a strong random JWT_SECRET.",
    );
    process.exit(1);
  }
  if (!env.ANTHROPIC_API_KEY || !env.ASSEMBLYAI_API_KEY) {
    console.error("Refusing to start: ANTHROPIC_API_KEY and ASSEMBLYAI_API_KEY are required.");
    process.exit(1);
  }
}

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`MeetingListener backend listening on :${env.PORT} (${env.NODE_ENV})`);
});
