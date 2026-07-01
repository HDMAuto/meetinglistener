import express, { type Express } from "express";
import { authRouter } from "./users/auth.routes.js";
import { meetingRouter } from "./meetings/meeting.routes.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/meetings", meetingRouter);

  return app;
}