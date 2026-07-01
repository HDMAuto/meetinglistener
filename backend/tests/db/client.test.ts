import { describe, it, expect } from "vitest";
import { prisma } from "../../src/db/client.js";

describe("prisma client", () => {
  it("can create and read a user", async () => {
    const user = await prisma.user.create({
      data: { name: "Ada", email: "ada@example.com", passwordHash: "x" },
    });
    expect(user.id).toBeTruthy();

    const found = await prisma.user.findUnique({ where: { email: "ada@example.com" } });
    expect(found?.name).toBe("Ada");
  });
});