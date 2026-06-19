import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma";
import { createSession, findSession, deleteSession, deleteUserSessions } from "./sessions";

async function makeUser() {
  return prisma.user.create({ data: { email: `u${Math.random()}@e.com`, passwordHash: "x" } });
}

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("sessions", () => {
  it("creates a session and finds it by raw token, storing only a hash", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    const row = await prisma.session.findFirst();
    expect(row!.tokenHash).not.toBe(token);
    const found = await findSession(token);
    expect(found!.userId).toBe(user.id);
  });

  it("returns null for an unknown token", async () => {
    expect(await findSession("nope")).toBeNull();
  });

  it("rejects and removes an expired session", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findSession(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("deletes a single session by token", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await deleteSession(token);
    expect(await findSession(token)).toBeNull();
  });

  it("deletes all of a user's sessions except an optional one", async () => {
    const user = await makeUser();
    const keep = await createSession(user.id);
    await createSession(user.id);
    await deleteUserSessions(user.id, keep.token);
    expect(await prisma.session.count()).toBe(1);
    expect(await findSession(keep.token)).not.toBeNull();
  });
});
