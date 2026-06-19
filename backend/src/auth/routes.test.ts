import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { prisma } from "../prisma";
import { errorMiddleware } from "../middleware/error";
import { authRouter } from "./routes";

function app() {
  const a = express();
  a.use(express.json());
  a.use(cookieParser());
  a.use("/auth", authRouter);
  a.use(errorMiddleware);
  return a;
}

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("auth routes", () => {
  it("signs up: creates user + workspace + membership, sets cookie", async () => {
    const res = await request(app()).post("/auth/signup").send({ email: "A@Example.com", password: "password1" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("a@example.com");
    expect(res.headers["set-cookie"][0]).toContain("sid=");
    expect(await prisma.workspace.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
  });

  it("rejects a short password with 400", async () => {
    const res = await request(app()).post("/auth/signup").send({ email: "a@e.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app()).post("/auth/signup").send({ email: "dup@e.com", password: "password1" });
    const res = await request(app()).post("/auth/signup").send({ email: "dup@e.com", password: "password1" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and 401s on wrong password", async () => {
    await request(app()).post("/auth/signup").send({ email: "l@e.com", password: "password1" });
    const ok = await request(app()).post("/auth/login").send({ email: "l@e.com", password: "password1" });
    expect(ok.status).toBe(200);
    const bad = await request(app()).post("/auth/login").send({ email: "l@e.com", password: "wrongpassword" });
    expect(bad.status).toBe(401);
  });

  it("GET /me returns the user when authed, 401 when not", async () => {
    const agent = request.agent(app());
    await agent.post("/auth/signup").send({ email: "me@e.com", password: "password1" });
    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("me@e.com");
    const anon = await request(app()).get("/auth/me");
    expect(anon.status).toBe(401);
  });

  it("logout clears the session", async () => {
    const agent = request.agent(app());
    await agent.post("/auth/signup").send({ email: "out@e.com", password: "password1" });
    expect((await agent.post("/auth/logout")).status).toBe(204);
    expect((await agent.get("/auth/me")).status).toBe(401);
  });

  it("change-password verifies current, updates, and invalidates other sessions", async () => {
    const agent = request.agent(app());
    await agent.post("/auth/signup").send({ email: "cp@e.com", password: "password1" });
    const other = request.agent(app());
    await other.post("/auth/login").send({ email: "cp@e.com", password: "password1" });

    const bad = await agent.post("/auth/change-password").send({ currentPassword: "wrong", newPassword: "password2" });
    expect(bad.status).toBe(400);

    const ok = await agent.post("/auth/change-password").send({ currentPassword: "password1", newPassword: "password2" });
    expect(ok.status).toBe(204);

    expect((await agent.get("/auth/me")).status).toBe(200);
    expect((await other.get("/auth/me")).status).toBe(401);
    expect((await request(app()).post("/auth/login").send({ email: "cp@e.com", password: "password2" })).status).toBe(200);
  });
});
