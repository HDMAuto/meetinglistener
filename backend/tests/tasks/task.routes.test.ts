import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createUser } from "../../src/users/user.service.js";
import { createMeeting } from "../../src/meetings/meeting.service.js";
import { createTasksFromAnalysis } from "../../src/tasks/task.service.js";
import { signToken } from "../../src/auth/jwt.js";

const app = createApp();

describe("task + notification routes", () => {
  it("lists tasks, assigns a flagged one, then completes it", async () => {
    const owner = await createUser({ name: "Sarah Kim", email: "o@x.com", password: "hunter2" });
    const token = signToken({ userId: owner.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Launch" });
    await createTasksFromAnalysis(meeting.id, {
      goal: "g", summary: "s",
      tasks: [{ description: "Book venue", assignee: "nobody", assigneeConfidence: "unknown" }],
    });

    const list = await request(app)
      .get(`/meetings/${meeting.id}/tasks`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const taskId = list.body[0].id as string;
    expect(list.body[0].status).toBe("needs_assignee");

    const assigned = await request(app)
      .post(`/tasks/${taskId}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assigneeId: owner.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assigneeId).toBe(owner.id);

    const notifs = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(notifs.body).toHaveLength(1);

    const done = await request(app)
      .post(`/tasks/${taskId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(done.body.status).toBe("done");
  });

  it("returns 404 assigning a task you don't own", async () => {
    const owner = await createUser({ name: "A", email: "a2@x.com", password: "hunter2" });
    const other = await createUser({ name: "B", email: "b2@x.com", password: "hunter2" });
    const otherToken = signToken({ userId: other.id });
    const meeting = await createMeeting({ ownerId: owner.id, title: "Private" });
    await createTasksFromAnalysis(meeting.id, {
      goal: "g", summary: "s",
      tasks: [{ description: "x", assignee: "nobody", assigneeConfidence: "unknown" }],
    });
    const [task] = await request(app)
      .get(`/meetings/${meeting.id}/tasks`)
      .set("Authorization", `Bearer ${signToken({ userId: owner.id })}`)
      .then((r) => r.body);

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ assigneeId: other.id });
    expect(res.status).toBe(404);
  });
});
