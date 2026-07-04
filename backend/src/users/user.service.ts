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