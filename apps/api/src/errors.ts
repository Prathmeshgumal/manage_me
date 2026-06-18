import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
export const asyncHandler = (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
