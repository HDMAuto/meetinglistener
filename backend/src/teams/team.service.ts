import { prisma } from "../db/client.js";

export interface TeamMemberInfo {
  id: string;
  name: string;
  email: string;
}

export interface TeamWithMembers {
  id: string;
  name: string;
  createdAt: Date;
  members: TeamMemberInfo[];
}

// Only active members appear in payloads; deactivated users stay in the join
// table (history) but are invisible everywhere.
const activeMembers = {
  where: { isActive: true },
  select: { id: true, name: true, email: true },
  orderBy: { name: "asc" as const },
};

export async function listTeams(ownerId: string): Promise<TeamWithMembers[]> {
  const teams = await prisma.team.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { members: activeMembers },
  });
  return teams.map(({ id, name, createdAt, members }) => ({ id, name, createdAt, members }));
}

// Every id must be an existing ACTIVE user.
async function memberIdsValid(memberIds: string[]): Promise<boolean> {
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return true;
  const count = await prisma.user.count({ where: { id: { in: unique }, isActive: true } });
  return count === unique.length;
}

export async function createTeam(
  ownerId: string,
  input: { name: string; memberIds: string[] },
): Promise<TeamWithMembers> {
  if (!(await memberIdsValid(input.memberIds))) throw new Error("INVALID_MEMBERS");
  const { id, name, createdAt, members } = await prisma.team.create({
    data: {
      ownerId,
      name: input.name,
      members: { connect: [...new Set(input.memberIds)].map((mid) => ({ id: mid })) },
    },
    include: { members: activeMembers },
  });
  return { id, name, createdAt, members };
}

export async function updateTeam(
  id: string,
  ownerId: string,
  patch: { name?: string; memberIds?: string[] },
): Promise<TeamWithMembers | null> {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return null;
  if (patch.memberIds !== undefined && !(await memberIdsValid(patch.memberIds))) {
    throw new Error("INVALID_MEMBERS");
  }
  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.memberIds !== undefined
        ? { members: { set: [...new Set(patch.memberIds)].map((mid) => ({ id: mid })) } }
        : {}),
    },
    include: { members: activeMembers },
  });
  return { id: team.id, name: team.name, createdAt: team.createdAt, members: team.members };
}

export async function deleteTeam(id: string, ownerId: string): Promise<boolean> {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return false;
  await prisma.team.delete({ where: { id } });
  return true;
}

// Lightweight ownership check for meeting creation.
export async function getOwnedTeam(id: string, ownerId: string): Promise<{ id: string } | null> {
  const team = await prisma.team.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!team || team.ownerId !== ownerId) return null;
  return { id: team.id };
}
