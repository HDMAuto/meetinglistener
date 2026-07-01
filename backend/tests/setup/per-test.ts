import { beforeEach } from "vitest";
import { prisma } from "../../src/db/client.js";

// Clean slate before each test. Delete children before parents so foreign
// keys never block a delete (notifications/tasks reference users).
beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.user.deleteMany();
});