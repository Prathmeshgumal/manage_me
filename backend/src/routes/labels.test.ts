import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";
const app = createApp();
beforeEach(async () => { await prisma.task.deleteMany(); await prisma.label.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("labels API", () => {
  it("creates, lists, deletes", async () => {
    const c = await request(app).post("/labels").send({ name: "bug", color: "#F4404A" });
    expect(c.status).toBe(201);
    expect((await request(app).get("/labels")).body[0].name).toBe("bug");
    expect((await request(app).delete(`/labels/${c.body.id}`)).status).toBe(204);
  });
  it("rejects empty name", async () => {
    expect((await request(app).post("/labels").send({ name: "" })).status).toBe(400);
  });
});
