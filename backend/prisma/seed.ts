import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Reset
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();

  const web = await prisma.project.create({ data: { name: "Website redesign", color: "#4FA3D1" } });
  const mobile = await prisma.project.create({ data: { name: "Mobile app", color: "#E0B341" } });

  const bug = await prisma.label.create({ data: { name: "bug", color: "#F4404A" } });
  const feature = await prisma.label.create({ data: { name: "feature", color: "#4FA3D1" } });
  const design = await prisma.label.create({ data: { name: "design", color: "#E0B341" } });

  const tasks: Array<Parameters<typeof prisma.task.create>[0]["data"]> = [
    { title: "Fix the login redirect loop", status: "IN_PROGRESS", priority: "URGENT", sortOrder: 1,
      projectId: web.id, labels: { connect: [{ id: bug.id }] } },
    { title: "Ship the priority heat-spine on cards", status: "IN_PROGRESS", priority: "HIGH", sortOrder: 2,
      projectId: web.id, labels: { connect: [{ id: feature.id }] } },
    { title: "Design the empty-state for the board", status: "TODO", priority: "MEDIUM", sortOrder: 1,
      projectId: web.id, labels: { connect: [{ id: design.id }] } },
    { title: "Wire up the command palette search ranking", status: "TODO", priority: "LOW", sortOrder: 2 },
    { title: "Add keyboard shortcut cheatsheet", status: "BACKLOG", priority: "NONE", sortOrder: 1,
      projectId: mobile.id },
    { title: "Evaluate offline-first sync for the app", status: "BACKLOG", priority: "MEDIUM", sortOrder: 2,
      projectId: mobile.id, labels: { connect: [{ id: feature.id }] } },
    { title: "Account & multi-user phase kickoff", status: "DONE", priority: "HIGH", sortOrder: 1 },
  ];

  for (const data of tasks) await prisma.task.create({ data });

  const count = await prisma.task.count();
  console.log(`Seeded ${count} tasks, 2 projects, 3 labels.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
