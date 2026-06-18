import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";

const app = createApp();

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("tasks API", () => {
  it("creates and lists a task", async () => {
    const create = await request(app).post("/tasks").send({ title: "First" });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe("First");
    expect(create.body.status).toBe("BACKLOG");

    const list = await request(app).get("/tasks");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(typeof list.body[0].createdAt).toBe("string");
  });

  it("rejects invalid create with 400", async () => {
    const res = await request(app).post("/tasks").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Validation failed");
  });

  it("patches status and 404s unknown id", async () => {
    const t = await request(app).post("/tasks").send({ title: "x" });
    const patch = await request(app).patch(`/tasks/${t.body.id}`).send({ status: "DONE", sortOrder: 5 });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe("DONE");
    expect(patch.body.sortOrder).toBe(5);

    expect((await request(app).patch("/tasks/nope").send({ status: "DONE" })).status).toBe(404);
  });

  it("filters by status", async () => {
    await request(app).post("/tasks").send({ title: "a", status: "TODO" });
    await request(app).post("/tasks").send({ title: "b", status: "DONE" });
    const res = await request(app).get("/tasks?status=TODO");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("a");
  });

  it("attaches labels", async () => {
    const label = await request(app).post("/labels").send({ name: "bug" });
    const t = await request(app).post("/tasks").send({ title: "y", labelIds: [label.body.id] });
    expect(t.body.labels).toHaveLength(1);
    expect(t.body.labels[0].name).toBe("bug");
  });

  it("deletes a task", async () => {
    const t = await request(app).post("/tasks").send({ title: "z" });
    expect((await request(app).delete(`/tasks/${t.body.id}`)).status).toBe(204);
    expect((await request(app).get("/tasks")).body).toHaveLength(0);
  });
});
