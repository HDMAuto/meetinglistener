import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { listTeams, createTeam, updateTeam, deleteTeam } from "./team.service.js";
import { asyncHandler } from "../http/asyncHandler.js";

export const teamRouter = Router();

teamRouter.use(requireAuth);

teamRouter.get("/", asyncHandler(async (req, res) => {
  return res.json(await listTeams(req.userId!));
}));

const createSchema = z.object({
  name: z.string().min(1),
  memberIds: z.array(z.string()),
});

teamRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  try {
    const team = await createTeam(req.userId!, parsed.data);
    return res.status(201).json(team);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_MEMBERS") {
      return res.status(400).json({ error: "INVALID_MEMBERS" });
    }
    throw err;
  }
}));

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    memberIds: z.array(z.string()).optional(),
  })
  .refine((p) => Object.keys(p).length > 0);

teamRouter.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });
  try {
    const team = await updateTeam(req.params.id, req.userId!, parsed.data);
    if (!team) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(team);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_MEMBERS") {
      return res.status(400).json({ error: "INVALID_MEMBERS" });
    }
    throw err;
  }
}));

teamRouter.delete("/:id", asyncHandler(async (req, res) => {
  const deleted = await deleteTeam(req.params.id, req.userId!);
  if (!deleted) return res.status(404).json({ error: "NOT_FOUND" });
  return res.status(204).end();
}));
