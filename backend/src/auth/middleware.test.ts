import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { prisma } from "../prisma";
import { createSession } from "./sessions";
import { requireAuth } from "./middleware";

function appWithGuard() {
  const app = express();
  app.use(cookieParser());
  app.get("/secret", requireAuth, (req, res) => res.json({ workspaceId: req.workspaceId, userId: req.userId }));
  return app;
}

async function userWithWorkspace() {
  const ws = await prisma.workspace.create({ data: {} });
  const user = await prisma.user.create({
    data: { email: `u${Math.random()}@e.com`, passwordHash: "x", memberships: { create: { role: "OWNER", workspaceId: ws.id } } },
  });
  return { user, ws };
}

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("requireAuth", () => {
  it("401s with no cookie", async () => {
    const res = await request(appWithGuard()).get("/secret");
    expect(res.status).toBe(401);
  });

  it("401s with an invalid token", async () => {
    const res = await request(appWithGuard()).get("/secret").set("Cookie", "sid=bogus");
    expect(res.status).toBe(401);
  });

  it("passes and attaches userId + workspaceId for a valid session", async () => {
    const { user, ws } = await userWithWorkspace();
    const { token } = await createSession(user.id);
    const res = await request(appWithGuard()).get("/secret").set("Cookie", `sid=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: user.id, workspaceId: ws.id });
  });
});
