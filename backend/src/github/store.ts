import { prisma } from "../prisma.js";
import { encryptToken, decryptToken } from "./crypto.js";

export async function saveUserToken(input: {
  githubUserId: number; login: string; avatarUrl: string; accessToken: string; scope: string;
}): Promise<void> {
  const data = {
    login: input.login, avatarUrl: input.avatarUrl,
    accessToken: encryptToken(input.accessToken), scope: input.scope,
  };
  await prisma.githubUserToken.upsert({
    where: { githubUserId: input.githubUserId },
    create: { githubUserId: input.githubUserId, ...data },
    update: data,
  });
}

export async function getUserToken(): Promise<{ login: string; avatarUrl: string; accessToken: string } | null> {
  const row = await prisma.githubUserToken.findFirst({ orderBy: { createdAt: "asc" } });
  if (!row) return null;
  return { login: row.login, avatarUrl: row.avatarUrl, accessToken: decryptToken(row.accessToken) };
}

export async function deleteUserToken(): Promise<void> {
  await prisma.githubUserToken.deleteMany();
}

export async function saveInstallation(i: {
  installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}): Promise<void> {
  const data = { accountLogin: i.accountLogin, accountType: i.accountType, repositorySelection: i.repositorySelection };
  await prisma.githubInstallation.upsert({
    where: { installationId: i.installationId },
    create: { installationId: i.installationId, ...data },
    update: data,
  });
}

export async function listInstallations(): Promise<Array<{
  installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}>> {
  const rows = await prisma.githubInstallation.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    installationId: r.installationId, accountLogin: r.accountLogin,
    accountType: r.accountType, repositorySelection: r.repositorySelection,
  }));
}
