import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { authedAgent, type Agent } from "../test/auth";

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  agent = await authedAgent(app);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("labels API", () => {
  it("creates, lists, deletes", async () => {
    const c = await agent.post("/labels").send({ name: "bug", color: "#F4404A" });
    expect(c.status).toBe(201);
    expect((await agent.get("/labels")).body[0].name).toBe("bug");
    expect((await agent.delete(`/labels/${c.body.id}`)).status).toBe(204);
  });
  it("rejects empty name", async () => {
    expect((await agent.post("/labels").send({ name: "" })).status).toBe(400);
  });
  it("isolates labels between workspaces", async () => {
    const mine = await agent.post("/labels").send({ name: "bug" });
    const other = await authedAgent(app);
    expect((await other.get("/labels")).body).toHaveLength(0);
    expect((await other.patch(`/labels/${mine.body.id}`).send({ name: "x" })).status).toBe(404);
    expect((await other.delete(`/labels/${mine.body.id}`)).status).toBe(404);
  });
});
