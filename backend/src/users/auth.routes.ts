import { Router } from "express";
import { z } from "zod";
import { verifyCredentials, changePassword } from "./user.service.js";
import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../http/asyncHandler.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: "ACCOUNT_DISABLED" });
  }
  const token = signToken({ userId: user.id });
  return res.status(200).json({ token, user });
}));

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

authRouter.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }
  const ok = await changePassword(
    req.userId!,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!ok) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  return res.status(204).end();
}));
