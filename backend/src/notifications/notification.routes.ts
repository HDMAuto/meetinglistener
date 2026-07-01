import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  return res.json(notifications);
});

notificationRouter.post("/:id/read", requireAuth, async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId!) return res.status(404).json({ error: "NOT_FOUND" });
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  return res.json(updated);
});
