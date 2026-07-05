import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth/middleware.js";
import { asyncHandler } from "../http/asyncHandler.js";
import {
  listUsers,
  listAllUsers,
  adminCreateUser,
  adminUpdateUser,
  setUserActive,
  adminResetPassword,
} from "./user.service.js";

export const userRouter = Router();

userRouter.use(requireAuth);

// GET /users — active users only (assignee/team pickers). Any authed user.
userRouter.get("/", asyncHandler(async (_req, res) => {
  return res.json(await listUsers());
}));

// Everything below is admin-only.
userRouter.use(requireAdmin);

userRouter.get("/all", asyncHandler(async (_req, res) => {
  return res.json(await listAllUsers());
}));

const roleEnum = z.enum(["admin", "member"]);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: roleEnum,
  tempPassword: z.string().min(6),
});

userRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  try {
    const user = await adminCreateUser(parsed.data);
    return res.status(201).json(user);
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "EMAIL_TAKEN" });
    }
    throw err;
  }
}));

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: roleEnum.optional(),
  })
  .refine((p) => Object.keys(p).length > 0);

userRouter.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  try {
    const user = await adminUpdateUser(req.params.id, parsed.data);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(user);
  } catch (err) {
    if (err instanceof Error && (err.message === "EMAIL_TAKEN" || err.message === "LAST_ADMIN")) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
}));

userRouter.post("/:id/deactivate", asyncHandler(async (req, res) => {
  try {
    const user = await setUserActive(req.params.id, false);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(user);
  } catch (err) {
    if (err instanceof Error && err.message === "LAST_ADMIN") {
      return res.status(409).json({ error: "LAST_ADMIN" });
    }
    throw err;
  }
}));

userRouter.post("/:id/reactivate", asyncHandler(async (req, res) => {
  const user = await setUserActive(req.params.id, true);
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(user);
}));

const resetSchema = z.object({ tempPassword: z.string().min(6) });

userRouter.post("/:id/reset-password", asyncHandler(async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  const user = await adminResetPassword(req.params.id, parsed.data.tempPassword);
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(user);
}));
