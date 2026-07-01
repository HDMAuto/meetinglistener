import { beforeEach } from "vitest";
import { prisma } from "../../src/db/client.js";

// Clean slate before each test. Delete children before parents.
beforeEach(async () => {
  await prisma.meeting.deleteMany();
  await prisma.user.deleteMany();
});