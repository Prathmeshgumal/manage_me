import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

async function main() {
  // Reset
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();

  const workspace = await prisma.workspace.create({ data: { name: "Demo Workspace" } });
  await prisma.user.create({
    data: {
      email: "demo@myschedule.app",
      passwordHash: hashPassword("password1"),
      memberships: { create: { role: "OWNER", workspaceId: workspace.id } },
    },
  });
  const workspaceId = workspace.id;

  const web = await prisma.project.create({ data: { name: "Website redesign", color: "#4FA3D1", workspaceId } });
  const mobile = await prisma.project.create({ data: { name: "Mobile app", color: "#E0B341", workspaceId } });

  const bug = await prisma.label.create({ data: { name: "bug", color: "#F4404A", workspaceId } });
  const feature = await prisma.label.create({ data: { name: "feature", color: "#4FA3D1", workspaceId } });
  const design = await prisma.label.create({ data: { name: "design", color: "#E0B341", workspaceId } });

  const tasks: Array<Parameters<typeof prisma.task.create>[0]["data"]> = [
    { title: "Fix the login redirect loop", status: "IN_PROGRESS", priority: "URGENT", sortOrder: 1,
      workspaceId, projectId: web.id, labels: { connect: [{ id: bug.id }] } },
    { title: "Ship the priority heat-spine on cards", status: "IN_PROGRESS", priority: "HIGH", sortOrder: 2,
      workspaceId, projectId: web.id, labels: { connect: [{ id: feature.id }] } },
    { title: "Design the empty-state for the board", status: "TODO", priority: "MEDIUM", sortOrder: 1,
      workspaceId, projectId: web.id, labels: { connect: [{ id: design.id }] } },
    { title: "Wire up the command palette search ranking", status: "TODO", priority: "LOW", sortOrder: 2, workspaceId },
    { title: "Add keyboard shortcut cheatsheet", status: "BACKLOG", priority: "NONE", sortOrder: 1,
      workspaceId, projectId: mobile.id },
    { title: "Evaluate offline-first sync for the app", status: "BACKLOG", priority: "MEDIUM", sortOrder: 2,
      workspaceId, projectId: mobile.id, labels: { connect: [{ id: feature.id }] } },
    { title: "Account & multi-user phase kickoff", status: "DONE", priority: "HIGH", sortOrder: 1, workspaceId },
  ];

  for (const data of tasks) await prisma.task.create({ data });

  const count = await prisma.task.count();
  console.log(`Seeded demo@myschedule.app / password1 with ${count} tasks, 2 projects, 3 labels.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
