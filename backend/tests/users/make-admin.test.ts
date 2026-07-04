import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createTestUser } from "../helpers/users.js";
import { makeAdmin } from "../../scripts/make-admin.js";

describe("makeAdmin", () => {
  it("promotes an existing user to active admin", async () => {
    const user = await createTestUser({ email: "promo@mk.test", isActive: false });
    const result = await makeAdmin("promo@mk.test");
    expect(result).toBe("OK");
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.role).toBe("admin");
    expect(fresh.isActive).toBe(true);
  });

  it("returns NOT_FOUND for an unknown email", async () => {
    expect(await makeAdmin("nobody@mk.test")).toBe("NOT_FOUND");
  });
});
