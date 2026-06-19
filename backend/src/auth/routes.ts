import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, AppError } from "../errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, deleteSession, deleteUserSessions } from "./sessions.js";
import { requireAuth } from "./middleware.js";
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE } from "./cookies.js";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});
const changePassword = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

const publicUser = (u: { id: string; email: string }) => ({ id: u.id, email: u.email });

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const normalized = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) {
    throw new AppError(409, "Email already registered");
  }
  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash: hashPassword(password),
      memberships: { create: { role: "OWNER", workspace: { create: {} } } },
    },
  });
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AppError(401, "Invalid email or password");
  }
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ user: publicUser(user) });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true },
  });
  if (!user) throw new AppError(401, "Unauthorized");
  res.json({ user });
}));

authRouter.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (token) await deleteSession(token);
  clearSessionCookie(res);
  res.status(204).end();
}));

authRouter.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePassword.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    throw new AppError(400, "Current password is incorrect");
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  await deleteUserSessions(user.id, token);
  res.status(204).end();
}));
