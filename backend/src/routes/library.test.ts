import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { authedAgent, type Agent } from "../test/auth";

const app = createApp();
let agent: Agent;

async function makeProject() {
  const res = await agent.post("/projects").send({ name: "Proj" });
  return res.body.id as string;
}

beforeEach(async () => {
  await prisma.page.deleteMany();
  await prisma.book.deleteMany();
  await prisma.shelf.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  agent = await authedAgent(app);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("library API", () => {
  it("lazily creates one shelf per project and is idempotent", async () => {
    const projectId = await makeProject();
    const a = await agent.get(`/projects/${projectId}/shelf`);
    expect(a.status).toBe(200);
    expect(a.body.projectId).toBe(projectId);
    expect(a.body.books).toEqual([]);
    const b = await agent.get(`/projects/${projectId}/shelf`);
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.shelf.count()).toBe(1);
  });

  it("provides a single general (project-less) shelf, idempotently", async () => {
    const a = await agent.get("/shelf");
    expect(a.status).toBe(200);
    expect(a.body.projectId).toBeNull();
    const b = await agent.get("/shelf");
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.shelf.count({ where: { projectId: null } })).toBe(1);
    const book = await agent.post(`/shelves/${a.body.id}/books`).send({ name: "Inbox" });
    expect(book.status).toBe(201);
  });

  it("creates a book and lists it on the shelf with pageCount", async () => {
    const projectId = await makeProject();
    const shelf = (await agent.get(`/projects/${projectId}/shelf`)).body;
    const created = await agent.post(`/shelves/${shelf.id}/books`).send({ name: "Notes" });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Notes");
    const reload = await agent.get(`/projects/${projectId}/shelf`);
    expect(reload.body.books).toHaveLength(1);
    expect(reload.body.books[0].pageCount).toBe(0);
  });

  it("rejects an empty book name with 400", async () => {
    const projectId = await makeProject();
    const shelf = (await agent.get(`/projects/${projectId}/shelf`)).body;
    const res = await agent.post(`/shelves/${shelf.id}/books`).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("creates/reads/patches a page", async () => {
    const projectId = await makeProject();
    const shelf = (await agent.get(`/projects/${projectId}/shelf`)).body;
    const book = (await agent.post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    const page = (await agent.post(`/books/${book.id}/pages`).send({ title: "P1" })).body;
    expect(page.content).toBe("");
    const got = await agent.get(`/pages/${page.id}`);
    expect(got.body.title).toBe("P1");
    const patched = await agent.patch(`/pages/${page.id}`).send({ content: "# Hello" });
    expect(patched.body.content).toBe("# Hello");
    const bookFull = await agent.get(`/books/${book.id}`);
    expect(bookFull.body.pages[0].title).toBe("P1");
  });

  it("cascades: deleting a book removes its pages", async () => {
    const projectId = await makeProject();
    const shelf = (await agent.get(`/projects/${projectId}/shelf`)).body;
    const book = (await agent.post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    await agent.post(`/books/${book.id}/pages`).send({ title: "P" });
    expect((await agent.delete(`/books/${book.id}`)).status).toBe(204);
    expect(await prisma.page.count()).toBe(0);
  });

  it("cascades: deleting a project removes shelf, books, pages", async () => {
    const projectId = await makeProject();
    const shelf = (await agent.get(`/projects/${projectId}/shelf`)).body;
    const book = (await agent.post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    await agent.post(`/books/${book.id}/pages`).send({ title: "P" });
    await agent.delete(`/projects/${projectId}`);
    expect(await prisma.shelf.count()).toBe(0);
    expect(await prisma.book.count()).toBe(0);
    expect(await prisma.page.count()).toBe(0);
  });

  it("isolates the general shelf and books between workspaces", async () => {
    const shelf = await agent.get("/shelf");
    const book = await agent.post(`/shelves/${shelf.body.id}/books`).send({ name: "Mine" });
    const other = await authedAgent(app);
    const otherShelf = await other.get("/shelf");
    expect(otherShelf.body.id).not.toBe(shelf.body.id);
    expect(otherShelf.body.books).toHaveLength(0);
    expect((await other.get(`/books/${book.body.id}`)).status).toBe(404);
    expect((await other.delete(`/books/${book.body.id}`)).status).toBe(404);
  });
});
