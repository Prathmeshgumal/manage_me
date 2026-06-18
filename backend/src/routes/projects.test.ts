import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";
const app = createApp();
beforeEach(async () => { await prisma.task.deleteMany(); await prisma.project.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("projects API", () => {
  it("creates, lists, updates, deletes", async () => {
    const c = await request(app).post("/projects").send({ name: "Web", color: "#4FA3D1" });
    expect(c.status).toBe(201);
    expect((await request(app).get("/projects")).body).toHaveLength(1);
    const u = await request(app).patch(`/projects/${c.body.id}`).send({ name: "Web v2" });
    expect(u.body.name).toBe("Web v2");
    expect((await request(app).delete(`/projects/${c.body.id}`)).status).toBe(204);
  });
  it("rejects bad color", async () => {
    expect((await request(app).post("/projects").send({ name: "x", color: "blue" })).status).toBe(400);
  });
});
