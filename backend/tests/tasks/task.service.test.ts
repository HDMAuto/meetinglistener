import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import {
  createTasksFromAnalysis,
  listMeetingTasks,
  assignTask,
  completeTask,
} from "../../src/tasks/task.service.js";

async function seed() {
  const owner = await createUser({ name: "Sarah Kim", email: "sarah@x.com", password: "hunter2" });
  await createUser({ name: "Bob Lee", email: "bob@x.com", password: "hunter2" });
  const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });
  return { owner, meeting };
}

describe("task.service", () => {
  it("creates tasks, auto-assigns confident matches, flags the rest, notifies", async () => {
    const { owner, meeting } = await seed();
    await createTasksFromAnalysis(meeting.id, {
      goal: "g",
      summary: "s",
      tasks: [
        { description: "Draft PR", assignee: "Sarah", assigneeConfidence: "high" },
        { description: "Book venue", assignee: "nobody", assigneeConfidence: "unknown" },
      ],
    });

    const tasks = await listMeetingTasks(meeting.id);
    expect(tasks).toHaveLength(2);

    const assigned = tasks.find((t) => t.description === "Draft PR")!;
    expect(assigned.assigneeId).toBe(owner.id);
    expect(assigned.status).toBe("open");
    expect(assigned.notifiedAt).not.toBeNull();

    const flagged = tasks.find((t) => t.description === "Book venue")!;
    expect(flagged.assigneeId).toBeNull();
    expect(flagged.status).toBe("needs_assignee");

    const notifs = await prisma.notification.findMany({ where: { userId: owner.id } });
    expect(notifs).toHaveLength(1);
  });

  it("assigns a flagged task and then completes it", async () => {
    const { owner, meeting } = await seed();
    await createTasksFromAnalysis(meeting.id, {
      goal: "g",
      summary: "s",
      tasks: [{ description: "Book venue", assignee: "nobody", assigneeConfidence: "unknown" }],
    });
    const [task] = await listMeetingTasks(meeting.id);

    const assigned = await assignTask(task.id, owner.id);
    expect(assigned.assigneeId).toBe(owner.id);
    expect(assigned.status).toBe("open");
    expect(assigned.notifiedAt).not.toBeNull();

    const done = await completeTask(task.id);
    expect(done.status).toBe("done");
  });
});