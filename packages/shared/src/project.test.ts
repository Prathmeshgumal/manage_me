import { describe, it, expect } from "vitest";
import { createProjectSchema } from "./project";

describe("createProjectSchema", () => {
  it("defaults color and requires name", () => {
    const r = createProjectSchema.safeParse({ name: "Web" });
    expect(r.success && r.data.color).toBe("#8A8A86");
  });
  it("rejects bad hex", () => {
    expect(createProjectSchema.safeParse({ name: "x", color: "red" }).success).toBe(false);
  });
});
