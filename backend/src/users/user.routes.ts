import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { listUsers } from "./user.service.js";

export const userRouter = Router();

// GET /users — all app users (for assignee pickers). Auth required.
userRouter.get("/", requireAuth, async (_req, res) => {
  return res.json(await listUsers());
});
