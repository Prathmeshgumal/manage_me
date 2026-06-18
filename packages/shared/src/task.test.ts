import { describe, it, expect } from "vitest";
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from "./task";

describe("createTaskSchema", () => {
  it("accepts a minimal valid task", () => {
    const r = createTaskSchema.safeParse({ title: "Ship it" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("BACKLOG");
      expect(r.data.priority).toBe("NONE");
    }
  });

  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("coerces dueDate string to Date", () => {
    const r = createTaskSchema.safeParse({ title: "x", dueDate: "2026-07-01" });
    expect(r.success && r.data.dueDate instanceof Date).toBe(true);
  });

  it("rejects unknown priority", () => {
    expect(createTaskSchema.safeParse({ title: "x", priority: "WHENEVER" }).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("allows partial updates incl. sortOrder", () => {
    const r = updateTaskSchema.safeParse({ sortOrder: 12.5, status: "DONE" });
    expect(r.success).toBe(true);
  });
  it("allows an empty object", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(true);
  });
});

describe("taskFilterSchema", () => {
  it("parses optional filters", () => {
    const r = taskFilterSchema.safeParse({ status: "TODO", projectId: "abc" });
    expect(r.success).toBe(true);
  });
});
