import { Router } from "express";
import { z } from "zod";
import { createUser, verifyCredentials } from "./user.service.js";
import { signToken } from "../auth/jwt.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });
  }
  try {
    const user = await createUser(parsed.data);
    const token = signToken({ userId: user.id });
    return res.status(201).json({ token, user });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "EMAIL_TAKEN" });
    }
    throw err;
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  const token = signToken({ userId: user.id });
  return res.status(200).json({ token, user });
});