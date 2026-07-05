import type { User } from "@prisma/client";
import { prisma } from "../db/client.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

export interface PublicUser {
    id:                 string;
    name:               string;
    email:              string;
    role:               string;
    isActive:           boolean;
    mustChangePassword: boolean;
    createdAt:          Date;
}

export function toPublicUser(user: User): PublicUser {
    return {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        role:               user.role,
        isActive:           user.isActive,
        mustChangePassword: user.mustChangePassword,
        createdAt:          user.createdAt,
    };
}

// Active users only — feeds assignee/team pickers.
export async function listUsers(): Promise<PublicUser[]> {
    const users = await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
    });
    return users.map(toPublicUser);
}

export async function createUser(input: {
    name:       string;
    email:      string;
    password:   string;
}): Promise<PublicUser> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new Error("EMAIL_TAKEN");

    const user = await prisma.user.create({
        data: {
            name:           input.name,
            email:          input.email,
            passwordHash:   await hashPassword(input.password),
        },
    });
    return toPublicUser(user);
}

export async function listAllUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return users.map(toPublicUser);
}

// Throws LAST_ADMIN if no OTHER active admin exists besides targetId.
// Accepts a Prisma client/transaction client so callers can run the count
// and the subsequent update atomically.
async function assertNotLastActiveAdmin(
  db: Pick<typeof prisma, "user">,
  targetId: string,
): Promise<void> {
  const others = await db.user.count({
    where: { role: "admin", isActive: true, NOT: { id: targetId } },
  });
  if (others === 0) throw new Error("LAST_ADMIN");
}

export async function adminCreateUser(input: {
  name: string;
  email: string;
  role: "admin" | "member";
  tempPassword: string;
}): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.tempPassword),
      mustChangePassword: true,
    },
  });
  return toPublicUser(user);
}

// null = not found. Throws EMAIL_TAKEN / LAST_ADMIN.
export async function adminUpdateUser(
  id: string,
  patch: { name?: string; email?: string; role?: "admin" | "member" },
): Promise<PublicUser | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return null;
  if (patch.email && patch.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: patch.email } });
    if (existing) throw new Error("EMAIL_TAKEN");
  }
  if (patch.role === "member" && target.role === "admin" && target.isActive) {
    // Count-then-update guard must be atomic: run both inside one transaction
    // so a concurrent demote/deactivate can't slip through between them.
    const user = await prisma.$transaction(async (tx) => {
      await assertNotLastActiveAdmin(tx, id);
      return tx.user.update({ where: { id }, data: patch });
    });
    return toPublicUser(user);
  }
  const user = await prisma.user.update({ where: { id }, data: patch });
  return toPublicUser(user);
}

// null = not found. Throws LAST_ADMIN when deactivating the last active admin.
export async function setUserActive(id: string, active: boolean): Promise<PublicUser | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return null;
  if (!active && target.role === "admin" && target.isActive) {
    // Count-then-update guard must be atomic: run both inside one transaction
    // so a concurrent demote/deactivate can't slip through between them.
    const user = await prisma.$transaction(async (tx) => {
      await assertNotLastActiveAdmin(tx, id);
      return tx.user.update({ where: { id }, data: { isActive: active } });
    });
    return toPublicUser(user);
  }
  const user = await prisma.user.update({ where: { id }, data: { isActive: active } });
  return toPublicUser(user);
}

// null = not found.
export async function adminResetPassword(
  id: string,
  tempPassword: string,
): Promise<PublicUser | null> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return null;
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  return toPublicUser(user);
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return toPublicUser(user);
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

// Verifies the current password before setting the new one; clears the
// first-login flag. Returns false when the user is unknown or the current
// password doesn't match.
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  return true;
}