import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("round-trips a correct password", () => {
    const stored = hashPassword("correct horse battery");
    expect(stored).toContain(":");
    expect(stored).not.toContain("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("right-one");
    expect(verifyPassword("wrong-one", stored)).toBe(false);
  });

  it("produces a different hash each call (random salt)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("returns false for a malformed stored value", () => {
    expect(verifyPassword("x", "garbage-no-colon")).toBe(false);
  });
});
