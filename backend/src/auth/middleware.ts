import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.js";
import "./types.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    const { userId } = verifyToken(header.slice("Bearer ".length));
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}