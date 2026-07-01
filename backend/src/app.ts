import express, { type Express } from "express";
import cors from "cors";
import { authRouter } from "./users/auth.routes.js";
import { userRouter } from "./users/user.routes.js";
import { meetingRouter } from "./meetings/meeting.routes.js";
import { audioRouter } from "./meetings/audio.routes.js";
import { meetingTaskRouter, taskRouter } from "./tasks/task.routes.js";
import { notificationRouter } from "./notifications/notification.routes.js";

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/users", userRouter);
  app.use("/meetings", meetingRouter);
  app.use("/meetings", audioRouter);
  app.use("/meetings", meetingTaskRouter);
  app.use("/tasks", taskRouter);
  app.use("/notifications", notificationRouter);

  return app;
}
