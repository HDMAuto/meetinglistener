import { prisma } from "../../src/db/client.js";
import { hashPassword } from "../../src/auth/password.js";
import { signToken } from "../../src/auth/jwt.js";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

// Creates a user directly in the DB (self-registration no longer exists)
// and mints a JWT for it.
export async function createTestUser(input: {
  email: string;
  name?: string;
  role?: "admin" | "member";
  isActive?: boolean;
  mustChangePassword?: boolean;
  password?: string;
}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      name: input.name ?? "Test User",
      email: input.email,
      passwordHash: await hashPassword(input.password ?? "hunter2"),
      role: input.role ?? "member",
      isActive: input.isActive ?? true,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: signToken({ userId: user.id }),
  };
}
