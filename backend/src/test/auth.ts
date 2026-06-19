import request from "supertest";
import type { Express } from "express";

export type Agent = ReturnType<typeof request.agent>;

let counter = 0;

/** Create a fresh user + workspace and return a cookie-persisting agent for it. */
export async function authedAgent(app: Express): Promise<Agent> {
  const agent = request.agent(app);
  const email = `user${counter++}_${Date.now()}@test.com`;
  const res = await agent.post("/auth/signup").send({ email, password: "password1" });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
