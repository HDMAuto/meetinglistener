import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { search } from "./search.service.js";
import { asyncHandler } from "../http/asyncHandler.js";

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get("/", asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) return res.status(400).json({ error: "INVALID_QUERY" });
  const results = await search(req.userId!, q);
  return res.json(results);
}));
