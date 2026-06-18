import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

export function errorMiddleware(
  err: unknown, _req: Request, res: Response, _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { message: "Validation failed", details: err.flatten() } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (typeof err === "object" && err && (err as { code?: string }).code === "P2025") {
    return res.status(404).json({ error: { message: "Not found" } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: "Internal server error" } });
}
