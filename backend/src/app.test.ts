import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { prisma } from "./prisma";
import { authedAgent } from "./test/auth";

const app = createApp();

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("app", () => {
  it("health is public", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("guards data routes with 401 when unauthenticated", async () => {
    expect((await request(app).get("/tasks")).status).toBe(401);
    expect((await request(app).get("/projects")).status).toBe(401);
  });

  it("unknown route 404s for an authenticated user", async () => {
    const agent = await authedAgent(app);
    expect((await agent.get("/definitely-not-a-route")).status).toBe(404);
  });
});
