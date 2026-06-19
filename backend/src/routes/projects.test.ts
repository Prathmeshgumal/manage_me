import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { authedAgent, type Agent } from "../test/auth";

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  agent = await authedAgent(app);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("projects API", () => {
  it("creates, lists, updates, deletes", async () => {
    const c = await agent.post("/projects").send({ name: "Web", color: "#4FA3D1" });
    expect(c.status).toBe(201);
    expect((await agent.get("/projects")).body).toHaveLength(1);
    const u = await agent.patch(`/projects/${c.body.id}`).send({ name: "Web v2" });
    expect(u.body.name).toBe("Web v2");
    expect((await agent.delete(`/projects/${c.body.id}`)).status).toBe(204);
  });
  it("rejects bad color", async () => {
    expect((await agent.post("/projects").send({ name: "x", color: "blue" })).status).toBe(400);
  });
  it("isolates projects between workspaces", async () => {
    const mine = await agent.post("/projects").send({ name: "Mine" });
    const other = await authedAgent(app);
    expect((await other.get("/projects")).body).toHaveLength(0);
    expect((await other.patch(`/projects/${mine.body.id}`).send({ name: "Hax" })).status).toBe(404);
    expect((await other.delete(`/projects/${mine.body.id}`)).status).toBe(404);
  });
});
