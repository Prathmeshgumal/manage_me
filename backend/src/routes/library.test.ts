import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";

const app = createApp();

async function makeProject() {
  const res = await request(app).post("/projects").send({ name: "Proj" });
  return res.body.id as string;
}

beforeEach(async () => {
  await prisma.page.deleteMany();
  await prisma.book.deleteMany();
  await prisma.shelf.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("library API", () => {
  it("lazily creates one shelf per project and is idempotent", async () => {
    const projectId = await makeProject();
    const a = await request(app).get(`/projects/${projectId}/shelf`);
    expect(a.status).toBe(200);
    expect(a.body.projectId).toBe(projectId);
    expect(a.body.books).toEqual([]);
    const b = await request(app).get(`/projects/${projectId}/shelf`);
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.shelf.count()).toBe(1);
  });

  it("provides a single general (project-less) shelf, idempotently", async () => {
    const a = await request(app).get("/shelf");
    expect(a.status).toBe(200);
    expect(a.body.projectId).toBeNull();
    const b = await request(app).get("/shelf");
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.shelf.count({ where: { projectId: null } })).toBe(1);
    // books can be created on it
    const book = await request(app).post(`/shelves/${a.body.id}/books`).send({ name: "Inbox" });
    expect(book.status).toBe(201);
  });

  it("creates a book and lists it on the shelf with pageCount", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const created = await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "Notes" });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Notes");
    const reload = await request(app).get(`/projects/${projectId}/shelf`);
    expect(reload.body.books).toHaveLength(1);
    expect(reload.body.books[0].pageCount).toBe(0);
  });

  it("rejects an empty book name with 400", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const res = await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("creates/reads/patches a page", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const book = (await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    const page = (await request(app).post(`/books/${book.id}/pages`).send({ title: "P1" })).body;
    expect(page.content).toBe("");
    const got = await request(app).get(`/pages/${page.id}`);
    expect(got.body.title).toBe("P1");
    const patched = await request(app).patch(`/pages/${page.id}`).send({ content: "# Hello" });
    expect(patched.body.content).toBe("# Hello");
    const bookFull = await request(app).get(`/books/${book.id}`);
    expect(bookFull.body.pages[0].title).toBe("P1");
  });

  it("cascades: deleting a book removes its pages", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const book = (await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    await request(app).post(`/books/${book.id}/pages`).send({ title: "P" });
    expect((await request(app).delete(`/books/${book.id}`)).status).toBe(204);
    expect(await prisma.page.count()).toBe(0);
  });

  it("cascades: deleting a project removes shelf, books, pages", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const book = (await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    await request(app).post(`/books/${book.id}/pages`).send({ title: "P" });
    await request(app).delete(`/projects/${projectId}`);
    expect(await prisma.shelf.count()).toBe(0);
    expect(await prisma.book.count()).toBe(0);
    expect(await prisma.page.count()).toBe(0);
  });
});
