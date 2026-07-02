import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  UPLOAD_DIR: z.string().default("uploads"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
  // Comma-separated list of allowed web origins for CORS. Unset = allow all
  // (fine for local dev). In production, set to the web dashboard origin(s).
  ALLOWED_ORIGINS: z.string().optional(),
});

export const env = schema.parse(process.env);

export const allowedOrigins: string[] =
  env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
