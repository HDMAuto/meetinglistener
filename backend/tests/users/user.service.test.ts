import { describe, it, expect } from "vitest";
import {
  createUser,
  verifyCredentials,
  findUserById,
} from "../../src/users/user.service.js";

describe("user.service", () => {
  it("creates a user and never exposes the hash", async () => {
    const user = await createUser({
      name: "Ada",
      email: "ada@example.com",
      password: "hunter2",
    });
    expect(user.email).toBe("ada@example.com");
    expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    await createUser({ name: "Ada", email: "dupe@example.com", password: "x" });
    await expect(
      createUser({ name: "Bob", email: "dupe@example.com", password: "y" }),
    ).rejects.toThrow("EMAIL_TAKEN");
  });

  it("verifies correct credentials and rejects wrong ones", async () => {
    await createUser({ name: "Ada", email: "login@example.com", password: "hunter2" });
    expect(await verifyCredentials("login@example.com", "hunter2")).not.toBeNull();
    expect(await verifyCredentials("login@example.com", "nope")).toBeNull();
    expect(await verifyCredentials("missing@example.com", "hunter2")).toBeNull();
  });

  it("finds a user by id", async () => {
    const created = await createUser({ name: "Ada", email: "id@example.com", password: "x" });
    const found = await findUserById(created.id);
    expect(found?.email).toBe("id@example.com");
  });
});