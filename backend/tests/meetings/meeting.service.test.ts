import { describe, it, expect } from "vitest";
import { createUser } from "../../src/users/user.service.js";
import {
  createMeeting,
  listMeetings,
  getMeeting,
} from "../../src/meetings/meeting.service.js";

async function makeUser(email: string) {
  return createUser({ name: "U", email, password: "hunter2" });
}

describe("meeting.service", () => {
  it("creates a meeting with default status 'recording'", async () => {
    const owner = await makeUser("owner1@example.com");
    const meeting = await createMeeting({ ownerId: owner.id, title: "Standup" });
    expect(meeting.id).toBeTruthy();
    expect(meeting.title).toBe("Standup");
    expect(meeting.status).toBe("recording");
    expect(meeting.ownerId).toBe(owner.id);
  });

  it("lists only the owner's meetings, newest first", async () => {
    const a = await makeUser("a@example.com");
    const b = await makeUser("b@example.com");
    await createMeeting({ ownerId: a.id, title: "First" });
    await createMeeting({ ownerId: a.id, title: "Second" });
    await createMeeting({ ownerId: b.id, title: "Other" });

    const list = await listMeetings(a.id);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("Second");
    expect(list.every((m) => m.ownerId === a.id)).toBe(true);
  });

  it("gets a meeting only for its owner", async () => {
    const a = await makeUser("ga@example.com");
    const b = await makeUser("gb@example.com");
    const m = await createMeeting({ ownerId: a.id, title: "Private" });

    expect((await getMeeting(m.id, a.id))?.title).toBe("Private");
    expect(await getMeeting(m.id, b.id)).toBeNull();
    expect(await getMeeting("missing", a.id)).toBeNull();
  });
});