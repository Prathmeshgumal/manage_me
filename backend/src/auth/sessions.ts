import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../prisma.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  await prisma.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function findSession(token: string) {
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function deleteUserSessions(userId: string, exceptToken?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptToken ? { tokenHash: { not: sha256(exceptToken) } } : {}) },
  });
}
