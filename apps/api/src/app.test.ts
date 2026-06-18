import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";

describe("app", () => {
  it("GET /health returns ok", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("unknown route returns 404 in error shape", async () => {
    const res = await request(createApp()).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBeTypeOf("string");
  });
});
