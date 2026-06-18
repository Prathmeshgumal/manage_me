import { describe, it, expect } from "vitest";
import { createLabelSchema } from "./label";

describe("createLabelSchema", () => {
  it("requires a non-empty name", () => {
    expect(createLabelSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
