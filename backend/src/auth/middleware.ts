import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.js";
import { prisma } from "../db/client.js";
import "./types.js";

// Verifies the JWT AND that the account still exists and is active, so a
// deactivated user's not-yet-expired token stops working immediately.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    const { userId } = verifyToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

// Mount after requireAuth.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}