import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import { allowedOrigins } from "./config/env.js";
import { authRouter } from "./users/auth.routes.js";
import { userRouter } from "./users/user.routes.js";
import { meetingRouter } from "./meetings/meeting.routes.js";
import { audioRouter } from "./meetings/audio.routes.js";
import { meetingTaskRouter, taskRouter } from "./tasks/task.routes.js";
import { notificationRouter } from "./notifications/notification.routes.js";
import { searchRouter } from "./search/search.routes.js";
import { teamRouter } from "./teams/team.routes.js";
import { downloadRouter } from "./downloads/download.routes.js";
import { errorHandler } from "./http/errorHandler.js";

// Native mobile (no Origin header) and the Electron desktop app (file:// →
// Origin "null") must always be allowed. Browsers are restricted to the
// configured origins; if none are configured, all origins are allowed (dev).
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || origin === "null") return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
};

export function createApp(): Express {
  const app = express();
  app.use(cors(corsOptions));
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
  app.use("/search", searchRouter);
  app.use("/teams", teamRouter);
  app.use("/download", downloadRouter);

  app.use(errorHandler);

  return app;
}
