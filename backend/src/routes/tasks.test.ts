import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { authedAgent, type Agent } from "../test/auth";

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  agent = await authedAgent(app);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("tasks API", () => {
  it("creates and lists a task", async () => {
    const create = await agent.post("/tasks").send({ title: "First" });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe("First");
    expect(create.body.status).toBe("BACKLOG");
    const list = await agent.get("/tasks");
    expect(list.body).toHaveLength(1);
    expect(typeof list.body[0].createdAt).toBe("string");
  });

  it("rejects invalid create with 400", async () => {
    const res = await agent.post("/tasks").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Validation failed");
  });

  it("patches status and 404s unknown id", async () => {
    const t = await agent.post("/tasks").send({ title: "x" });
    const patch = await agent.patch(`/tasks/${t.body.id}`).send({ status: "DONE", sortOrder: 5 });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe("DONE");
    expect((await agent.patch("/tasks/nope").send({ status: "DONE" })).status).toBe(404);
  });

  it("filters by status", async () => {
    await agent.post("/tasks").send({ title: "a", status: "TODO" });
    await agent.post("/tasks").send({ title: "b", status: "DONE" });
    const res = await agent.get("/tasks?status=TODO");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("a");
  });

  it("attaches labels", async () => {
    const label = await agent.post("/labels").send({ name: "bug" });
    const t = await agent.post("/tasks").send({ title: "y", labelIds: [label.body.id] });
    expect(t.body.labels[0].name).toBe("bug");
  });

  it("deletes a task", async () => {
    const t = await agent.post("/tasks").send({ title: "z" });
    expect((await agent.delete(`/tasks/${t.body.id}`)).status).toBe(204);
    expect((await agent.get("/tasks")).body).toHaveLength(0);
  });

  it("isolates tasks between workspaces", async () => {
    const mine = await agent.post("/tasks").send({ title: "mine" });
    const other = await authedAgent(app);
    expect((await other.get("/tasks")).body).toHaveLength(0);
    expect((await other.get(`/tasks/${mine.body.id}`)).status).toBe(404);
    expect((await other.patch(`/tasks/${mine.body.id}`).send({ status: "DONE" })).status).toBe(404);
    expect((await other.delete(`/tasks/${mine.body.id}`)).status).toBe(404);
  });
});
