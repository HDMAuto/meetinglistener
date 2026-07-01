import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  UPLOAD_DIR: z.string().default("uploads"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);