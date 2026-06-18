import { Router } from "express";
import { asyncHandler, AppError } from "../errors.js";
import { githubConfig } from "./config.js";
import { signState, verifyState } from "./crypto.js";
import { authorizeUrl, exchangeCode, getAuthedUser } from "./oauth.js";
import { getInstallation } from "./appAuth.js";
import { fetchContributions } from "./contributions.js";
import {
  saveUserToken, getUserToken, deleteUserToken, saveInstallation, listInstallations,
} from "./store.js";

export const githubRouter = Router();

githubRouter.get("/status", asyncHandler(async (_req, res) => {
  const user = await getUserToken();
  res.json({
    user: user ? { login: user.login, avatarUrl: user.avatarUrl } : null,
    installations: await listInstallations(),
  });
}));

githubRouter.get("/authorize", asyncHandler(async (_req, res) => {
  res.redirect(authorizeUrl(signState()));
}));

githubRouter.get("/callback", asyncHandler(async (req, res) => {
  const { frontendUrl } = githubConfig();
  const back = `${frontendUrl}/settings/github`;
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  if (!verifyState(state)) return res.redirect(`${back}?error=state`);
  if (!code) return res.redirect(`${back}?error=code`);
  const { accessToken, scope } = await exchangeCode(code);
  const user = await getAuthedUser(accessToken);
  await saveUserToken({ githubUserId: user.id, login: user.login, avatarUrl: user.avatarUrl, accessToken, scope });
  res.redirect(`${back}?connected=1`);
}));

githubRouter.get("/install", asyncHandler(async (_req, res) => {
  const { slug } = githubConfig();
  res.redirect(`https://github.com/apps/${slug}/installations/new`);
}));

githubRouter.get("/setup", asyncHandler(async (req, res) => {
  const { frontendUrl } = githubConfig();
  const back = `${frontendUrl}/settings/github`;
  const installationId = Number(req.query.installation_id);
  if (!installationId) return res.redirect(`${back}?error=install`);
  const meta = await getInstallation(installationId);
  await saveInstallation(meta);
  res.redirect(`${back}?installed=1`);
}));

githubRouter.get("/contributions", asyncHandler(async (_req, res) => {
  const user = await getUserToken();
  if (!user) throw new AppError(409, "GitHub not connected");
  res.json(await fetchContributions(user.accessToken));
}));

githubRouter.post("/disconnect", asyncHandler(async (_req, res) => {
  await deleteUserToken();
  res.status(204).end();
}));
