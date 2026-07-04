import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createTestUser } from "../helpers/users.js";
import { listUsers } from "../../src/users/user.service.js";
import { createTasksFromAnalysis } from "../../src/tasks/task.service.js";

describe("role/isActive plumbing", () => {
  it("listUsers returns only active users and includes role", async () => {
    await createTestUser({ email: "active@plumb.test", name: "Active Al" });
    await createTestUser({ email: "gone@plumb.test", name: "Gone Greta", isActive: false });

    const users = await listUsers();

    expect(users.map((u) => u.email)).toEqual(["active@plumb.test"]);
    expect(users[0].role).toBe("member");
    expect(users[0].isActive).toBe(true);
  });

  it("auto-assignment never targets deactivated users", async () => {
    const owner = await createTestUser({ email: "owner@plumb.test" });
    await createTestUser({ email: "dana@plumb.test", name: "Dana", isActive: false });
    const meeting = await prisma.meeting.create({
      data: { ownerId: owner.id, title: "M", status: "ready" },
    });

    await createTasksFromAnalysis(meeting.id, {
      goal: "g",
      summary: "s",
      tasks: [{ description: "Do the thing", assignee: "Dana", assigneeConfidence: "high" }],
    });

    const tasks = await prisma.task.findMany({ where: { meetingId: meeting.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assigneeId).toBeNull();
    expect(tasks[0].status).toBe("needs_assignee");
  });
});
