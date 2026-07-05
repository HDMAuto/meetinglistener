import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";

// Terminal error middleware: nothing unexpected may crash the process or
// leave a request hanging. P2002 on User.email maps to the same EMAIL_TAKEN
// clients already handle (closes the create/update check-then-act race).
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    (err.meta?.target as string[] | string | undefined)?.includes?.("email")
  ) {
    res.status(409).json({ error: "EMAIL_TAKEN" });
    return;
  }
  console.error("Unhandled route error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "INTERNAL" });
  }
};
