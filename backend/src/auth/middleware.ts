import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../errors.js";
import { prisma } from "../prisma.js";
import { findSession } from "./sessions.js";
import { SESSION_COOKIE } from "./cookies.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
    }
  }
}

function unauthorized(res: Response) {
  return res.status(401).json({ error: { message: "Unauthorized" } });
}

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return unauthorized(res);
  const session = await findSession(token);
  if (!session) return unauthorized(res);
  const membership = await prisma.membership.findFirst({ where: { userId: session.userId } });
  if (!membership) return unauthorized(res);
  req.userId = session.userId;
  req.workspaceId = membership.workspaceId;
  next();
});
