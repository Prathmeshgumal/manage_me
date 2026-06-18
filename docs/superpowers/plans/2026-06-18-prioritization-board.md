# MySchedule Prioritization Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user, no-auth, Linear-style task prioritization board (Board + List views, drag-and-drop, ⌘K palette) as a pnpm monorepo with an Express/Prisma/Postgres API and a React/Vite/shadcn frontend, deployable separately on Render + Vercel.

**Architecture:** Three workspaces — `apps/web` (React + Vite + shadcn/ui), `apps/api` (Express + Prisma), `packages/shared` (Zod schemas + TS types as the API contract). The frontend talks REST/JSON to the API via TanStack Query; both ends import validation schemas from `shared` so the contract cannot drift. The API operates on a single implicit workspace.

**Tech Stack:** pnpm workspaces + Turborepo, TypeScript everywhere, Express, Prisma, Neon Postgres, Zod, Vitest, React 18, Vite, Tailwind, shadcn/ui, TanStack Query, dnd-kit, cmdk.

## Global Constraints

- **Package manager:** pnpm only. All deps via `pnpm add`. Node >= 20.
- **Language:** TypeScript strict mode in every workspace.
- **Git:** Commit as the configured repo identity. NEVER add a `Co-Authored-By: Claude` trailer or author/commit as "Claude". Primary branch is `main`.
- **API contract:** Request/response shapes are defined once in `packages/shared` (Zod) and imported by both ends. No duplicated type definitions.
- **Error shape:** All API errors return `{ error: { message: string, details?: unknown } }` with an appropriate HTTP status.
- **Enums (verbatim):** `Status = BACKLOG | TODO | IN_PROGRESS | DONE | CANCELED`. `Priority = NONE | LOW | MEDIUM | HIGH | URGENT`.
- **Design tokens (verbatim):** bg light `#FAFAF8` / dark `#131316`; surface `#FFFFFF` / `#1C1C21`; border `#E7E7E2` / `#2A2A30`; ink `#1A1A18` / `#ECECEE`; ink-muted `#6B6B64` / `#9A9AA0`. Priority heat ramp: Urgent `#F4404A`, High `#F5872B`, Medium `#E0B341`, Low `#4FA3D1`, None `#8A8A86`. Fonts: Space Grotesk (display), IBM Plex Sans (body), IBM Plex Mono (data).
- **Accessibility:** priority never encoded by color alone (always label + glyph too); visible focus rings; respect `prefers-reduced-motion`.

---

## File Structure

```
MySchedule/
├── package.json                # root, pnpm workspaces + turbo scripts
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .nvmrc                      # 20
├── packages/shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # re-exports
│       ├── enums.ts            # Status, Priority
│       ├── task.ts             # task Zod schemas + types
│       ├── project.ts          # project Zod schemas + types
│       ├── label.ts            # label Zod schemas + types
│       └── *.test.ts           # vitest
├── apps/api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.ts            # server bootstrap (listen)
│       ├── app.ts              # express app factory (testable, no listen)
│       ├── prisma.ts           # PrismaClient singleton
│       ├── errors.ts           # AppError + asyncHandler
│       ├── middleware/error.ts # central error middleware
│       ├── routes/tasks.ts
│       ├── routes/projects.ts
│       ├── routes/labels.ts
│       └── routes/*.test.ts    # supertest + vitest
└── apps/web/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── components.json         # shadcn
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css           # tokens + fonts
        ├── lib/api.ts          # fetch wrapper
        ├── lib/utils.ts        # cn()
        ├── lib/priority.ts     # heat ramp + glyph map
        ├── hooks/useTasks.ts   # TanStack Query hooks
        ├── hooks/useProjects.ts
        ├── hooks/useLabels.ts
        ├── components/ui/...   # shadcn generated
        ├── components/layout/Sidebar.tsx
        ├── components/layout/Topbar.tsx
        ├── components/board/BoardView.tsx
        ├── components/board/Column.tsx
        ├── components/board/TaskCard.tsx
        ├── components/list/ListView.tsx
        ├── components/task/QuickCreateDialog.tsx
        ├── components/task/TaskDetailDrawer.tsx
        ├── components/command/CommandPalette.tsx
        └── components/theme/ThemeProvider.tsx
```

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.gitignore` (exists — verify)

**Interfaces:**
- Produces: pnpm workspaces rooted at `packages/*` and `apps/*`; root scripts `dev`, `build`, `lint`, `test` delegating to turbo.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create `.nvmrc`**

```
20
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "myschedule",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 6: Install and verify**

Run: `pnpm install`
Expected: completes, creates `pnpm-lock.yaml`, no workspace errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm + turborepo monorepo"
```

---

## Task 2: Shared enums + Zod schemas (TDD)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/{index,enums,task,project,label}.ts`
- Test: `packages/shared/src/{task,project,label}.test.ts`

**Interfaces:**
- Produces (imported by api + web):
  - `Status`, `Priority` (string-literal Zod enums + TS types)
  - `createTaskSchema`, `updateTaskSchema`, `taskSchema`, `taskFilterSchema` + types `CreateTaskInput`, `UpdateTaskInput`, `Task`, `TaskFilter`
  - `createProjectSchema`, `updateProjectSchema`, `projectSchema` + types `CreateProjectInput`, `UpdateProjectInput`, `Project`
  - `createLabelSchema`, `labelSchema` + types `CreateLabelInput`, `Label`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@myschedule/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "vitest": "^2.0.5", "typescript": "^5.5.4" }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Install deps**

Run: `pnpm install`
Expected: `zod` + `vitest` resolved under the workspace.

- [ ] **Step 4: Write `packages/shared/src/enums.ts`**

```ts
import { z } from "zod";

export const statusEnum = z.enum([
  "BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED",
]);
export type Status = z.infer<typeof statusEnum>;

export const priorityEnum = z.enum([
  "NONE", "LOW", "MEDIUM", "HIGH", "URGENT",
]);
export type Priority = z.infer<typeof priorityEnum>;
```

- [ ] **Step 5: Write the failing test `packages/shared/src/task.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from "./task";

describe("createTaskSchema", () => {
  it("accepts a minimal valid task", () => {
    const r = createTaskSchema.safeParse({ title: "Ship it" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("BACKLOG");   // default
      expect(r.data.priority).toBe("NONE");     // default
    }
  });

  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("coerces dueDate string to Date", () => {
    const r = createTaskSchema.safeParse({ title: "x", dueDate: "2026-07-01" });
    expect(r.success && r.data.dueDate instanceof Date).toBe(true);
  });

  it("rejects unknown priority", () => {
    expect(createTaskSchema.safeParse({ title: "x", priority: "WHENEVER" }).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("allows partial updates incl. sortOrder", () => {
    const r = updateTaskSchema.safeParse({ sortOrder: 12.5, status: "DONE" });
    expect(r.success).toBe(true);
  });
  it("rejects empty object as no-op? no — empty is allowed", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(true);
  });
});

describe("taskFilterSchema", () => {
  it("parses optional filters", () => {
    const r = taskFilterSchema.safeParse({ status: "TODO", projectId: "abc" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @myschedule/shared test`
Expected: FAIL — cannot find module `./task`.

- [ ] **Step 7: Implement `packages/shared/src/task.ts`**

```ts
import { z } from "zod";
import { statusEnum, priorityEnum } from "./enums";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(20000).nullish(),
  status: statusEnum.default("BACKLOG"),
  priority: priorityEnum.default("NONE"),
  dueDate: z.coerce.date().nullish(),
  projectId: z.string().nullish(),
  labelIds: z.array(z.string()).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).nullish(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().nullish(),
  projectId: z.string().nullish(),
  sortOrder: z.number().optional(),
  labelIds: z.array(z.string()).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskFilterSchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  projectId: z.string().optional(),
  labelId: z.string().optional(),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const labelRefSchema = z.object({
  id: z.string(), name: z.string(), color: z.string(),
});
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: statusEnum,
  priority: priorityEnum,
  dueDate: z.string().nullable(),   // ISO over the wire
  projectId: z.string().nullable(),
  sortOrder: z.number(),
  labels: z.array(labelRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @myschedule/shared test`
Expected: PASS (task suite).

- [ ] **Step 9: Write `packages/shared/src/project.ts` + `label.ts`**

```ts
// project.ts
import { z } from "zod";
const HEX = z.string().regex(/^#([0-9a-fA-F]{6})$/, "must be a #RRGGBB hex");
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  color: HEX.default("#8A8A86"),
});
export const updateProjectSchema = createProjectSchema.partial();
export const projectSchema = z.object({
  id: z.string(), name: z.string(), color: z.string(),
  createdAt: z.string(), updatedAt: z.string(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type Project = z.infer<typeof projectSchema>;
```

```ts
// label.ts
import { z } from "zod";
const HEX = z.string().regex(/^#([0-9a-fA-F]{6})$/, "must be a #RRGGBB hex");
export const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: HEX.default("#8A8A86"),
});
export const labelSchema = z.object({
  id: z.string(), name: z.string(), color: z.string(), createdAt: z.string(),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type Label = z.infer<typeof labelSchema>;
```

- [ ] **Step 10: Write `packages/shared/src/index.ts`**

```ts
export * from "./enums";
export * from "./task";
export * from "./project";
export * from "./label";
```

- [ ] **Step 11: Add matching tests for project + label**

```ts
// project.test.ts
import { describe, it, expect } from "vitest";
import { createProjectSchema } from "./project";
describe("createProjectSchema", () => {
  it("defaults color and requires name", () => {
    const r = createProjectSchema.safeParse({ name: "Web" });
    expect(r.success && r.data.color).toBe("#8A8A86");
  });
  it("rejects bad hex", () => {
    expect(createProjectSchema.safeParse({ name: "x", color: "red" }).success).toBe(false);
  });
});
```

```ts
// label.test.ts
import { describe, it, expect } from "vitest";
import { createLabelSchema } from "./label";
describe("createLabelSchema", () => {
  it("requires a non-empty name", () => {
    expect(createLabelSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 12: Run full shared suite**

Run: `pnpm --filter @myschedule/shared test`
Expected: PASS (all suites).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(shared): zod schemas and types for tasks, projects, labels"
```

---

## Task 3: API app skeleton + error handling (TDD)

**Files:**
- Create: `apps/api/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/app.ts`, `src/index.ts`, `src/errors.ts`, `src/middleware/error.ts`, `src/prisma.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces:
  - `createApp(): express.Express` — app factory with JSON parsing, routes mounted, error middleware last. No `listen`.
  - `class AppError extends Error { status: number; details?: unknown }`
  - `asyncHandler(fn)` — wraps async route handlers, forwards rejections to `next`.
  - `errorMiddleware(err, req, res, next)` — emits `{ error: { message, details? } }`.
  - `prisma` — shared `PrismaClient` instance.
  - `GET /health` → `{ ok: true }`.

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@myschedule/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@myschedule/shared": "workspace:*",
    "@prisma/client": "^5.18.0",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.18.0",
    "supertest": "^7.0.0",
    "tsx": "^4.17.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "types": ["node"] },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 4: Install deps**

Run: `pnpm install`
Expected: api workspace deps resolved.

- [ ] **Step 5: Write `src/errors.ts`**

```ts
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
```

- [ ] **Step 6: Write `src/middleware/error.ts`**

```ts
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
  // Prisma "record not found" for update/delete
  if (typeof err === "object" && err && (err as { code?: string }).code === "P2025") {
    return res.status(404).json({ error: { message: "Not found" } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: "Internal server error" } });
}
```

- [ ] **Step 7: Write `src/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

- [ ] **Step 8: Write the failing test `src/app.test.ts`**

```ts
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
```

- [ ] **Step 9: Run test to verify it fails**

Run: `pnpm --filter @myschedule/api test`
Expected: FAIL — cannot find `./app`.

- [ ] **Step 10: Write `src/app.ts`**

```ts
import express from "express";
import cors from "cors";
import { AppError } from "./errors.js";
import { errorMiddleware } from "./middleware/error.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { labelsRouter } from "./routes/labels.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/tasks", tasksRouter);
  app.use("/projects", projectsRouter);
  app.use("/labels", labelsRouter);

  app.use((_req, _res, next) => next(new AppError(404, "Not found")));
  app.use(errorMiddleware);
  return app;
}
```

> Note: routers are created in Tasks 5–7. To keep this task independently runnable, temporarily create empty routers (`export const tasksRouter = express.Router();` etc. in their files) — Task 5–7 fill them in. Create the three stub files now.

- [ ] **Step 11: Create router stubs**

```ts
// src/routes/tasks.ts
import { Router } from "express";
export const tasksRouter = Router();
```
```ts
// src/routes/projects.ts
import { Router } from "express";
export const projectsRouter = Router();
```
```ts
// src/routes/labels.ts
import { Router } from "express";
export const labelsRouter = Router();
```

- [ ] **Step 12: Write `src/index.ts`**

```ts
import { createApp } from "./app.js";
const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => console.log(`API on :${port}`));
```

- [ ] **Step 13: Run test to verify it passes**

Run: `pnpm --filter @myschedule/api test`
Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(api): express app factory, error handling, health route"
```

---

## Task 4: Prisma schema + migration

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/.env.example`
- Modify: `.gitignore` (ensure `.env` ignored — already is)

**Interfaces:**
- Produces: Prisma models `Task`, `Project`, `Label`, with implicit M2M `Task.labels`/`Label.tasks`; generated client used by route tasks.

- [ ] **Step 1: Write `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Status   { BACKLOG TODO IN_PROGRESS DONE CANCELED }
enum Priority { NONE LOW MEDIUM HIGH URGENT }

model Project {
  id        String   @id @default(cuid())
  name      String
  color     String   @default("#8A8A86")
  tasks     Task[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Label {
  id        String   @id @default(cuid())
  name      String
  color     String   @default("#8A8A86")
  tasks     Task[]
  createdAt DateTime @default(now())
}

model Task {
  id          String    @id @default(cuid())
  title       String
  description String?
  status      Status    @default(BACKLOG)
  priority    Priority  @default(NONE)
  dueDate     DateTime?
  sortOrder   Float     @default(0)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  projectId   String?
  labels      Label[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status, sortOrder])
  @@index([priority, sortOrder])
  @@index([projectId])
}
```

- [ ] **Step 2: Write `apps/api/.env.example`**

```
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
PORT=4000
```

- [ ] **Step 3: Create a local `.env`**

Create `apps/api/.env` with a real Neon (or local) `DATABASE_URL`. (Not committed.)

- [ ] **Step 4: Generate client + run first migration**

Run: `pnpm --filter @myschedule/api exec prisma migrate dev --name init`
Expected: creates `prisma/migrations/<ts>_init/`, applies it, generates client. No errors.

- [ ] **Step 5: Commit (migration only; never `.env`)**

```bash
git add apps/api/prisma .gitignore apps/api/.env.example
git commit -m "feat(api): prisma schema and initial migration"
```

---

## Task 5: Tasks API (TDD)

**Files:**
- Modify: `apps/api/src/routes/tasks.ts`
- Test: `apps/api/src/routes/tasks.test.ts`

**Interfaces:**
- Consumes: `prisma`, `asyncHandler`, `AppError`, shared `createTaskSchema`, `updateTaskSchema`, `taskFilterSchema`.
- Produces routes on `tasksRouter`:
  - `GET /tasks` (filters via query) → `Task[]` ordered by `sortOrder asc`
  - `POST /tasks` (body `CreateTaskInput`) → `Task` (201)
  - `GET /tasks/:id` → `Task` | 404
  - `PATCH /tasks/:id` (body `UpdateTaskInput`) → `Task` | 404
  - `DELETE /tasks/:id` → 204 | 404
- Serialization helper `serializeTask(row)` converting dates → ISO and flattening `labels` to `{id,name,color}[]`.

- [ ] **Step 1: Write failing test `src/routes/tasks.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";

const app = createApp();

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("tasks API", () => {
  it("creates and lists a task", async () => {
    const create = await request(app).post("/tasks").send({ title: "First" });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe("First");
    expect(create.body.status).toBe("BACKLOG");

    const list = await request(app).get("/tasks");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(typeof list.body[0].createdAt).toBe("string");
  });

  it("rejects invalid create with 400", async () => {
    const res = await request(app).post("/tasks").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Validation failed");
  });

  it("patches status and 404s unknown id", async () => {
    const t = await request(app).post("/tasks").send({ title: "x" });
    const patch = await request(app).patch(`/tasks/${t.body.id}`).send({ status: "DONE", sortOrder: 5 });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe("DONE");
    expect(patch.body.sortOrder).toBe(5);

    expect((await request(app).patch("/tasks/nope").send({ status: "DONE" })).status).toBe(404);
  });

  it("filters by status", async () => {
    await request(app).post("/tasks").send({ title: "a", status: "TODO" });
    await request(app).post("/tasks").send({ title: "b", status: "DONE" });
    const res = await request(app).get("/tasks?status=TODO");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("a");
  });

  it("attaches labels", async () => {
    const label = await request(app).post("/labels").send({ name: "bug" });
    const t = await request(app).post("/tasks").send({ title: "y", labelIds: [label.body.id] });
    expect(t.body.labels).toHaveLength(1);
    expect(t.body.labels[0].name).toBe("bug");
  });

  it("deletes a task", async () => {
    const t = await request(app).post("/tasks").send({ title: "z" });
    expect((await request(app).delete(`/tasks/${t.body.id}`)).status).toBe(204);
    expect((await request(app).get("/tasks")).body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @myschedule/api test src/routes/tasks.test.ts`
Expected: FAIL (router empty → 404s / shape mismatches). Requires a reachable test DB (`DATABASE_URL`).

- [ ] **Step 3: Implement `src/routes/tasks.ts`**

```ts
import { Router } from "express";
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from "@myschedule/shared";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const tasksRouter = Router();

const taskInclude = { labels: { select: { id: true, name: true, color: true } } } as const;

type Row = {
  id: string; title: string; description: string | null;
  status: string; priority: string; dueDate: Date | null;
  projectId: string | null; sortOrder: number;
  labels: { id: string; name: string; color: string }[];
  createdAt: Date; updatedAt: Date;
};

function serializeTask(t: Row) {
  return {
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

tasksRouter.get("/", asyncHandler(async (req, res) => {
  const f = taskFilterSchema.parse(req.query);
  const rows = await prisma.task.findMany({
    where: {
      status: f.status, priority: f.priority, projectId: f.projectId,
      ...(f.labelId ? { labels: { some: { id: f.labelId } } } : {}),
    },
    include: taskInclude,
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows.map(serializeTask));
}));

tasksRouter.post("/", asyncHandler(async (req, res) => {
  const { labelIds, ...data } = createTaskSchema.parse(req.body);
  const row = await prisma.task.create({
    data: { ...data, labels: labelIds ? { connect: labelIds.map((id) => ({ id })) } : undefined },
    include: taskInclude,
  });
  res.status(201).json(serializeTask(row));
}));

tasksRouter.get("/:id", asyncHandler(async (req, res, next) => {
  const row = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
  if (!row) return res.status(404).json({ error: { message: "Not found" } });
  res.json(serializeTask(row));
}));

tasksRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { labelIds, ...data } = updateTaskSchema.parse(req.body);
  const row = await prisma.task.update({
    where: { id: req.params.id },
    data: { ...data, labels: labelIds ? { set: labelIds.map((id) => ({ id })) } : undefined },
    include: taskInclude,
  });
  res.json(serializeTask(row));   // P2025 → 404 via error middleware
}));

tasksRouter.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @myschedule/api test src/routes/tasks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): tasks CRUD with filtering and label attachment"
```

---

## Task 6: Projects API (TDD)

**Files:**
- Modify: `apps/api/src/routes/projects.ts`
- Test: `apps/api/src/routes/projects.test.ts`

**Interfaces:**
- Consumes: `prisma`, `asyncHandler`, shared `createProjectSchema`, `updateProjectSchema`.
- Produces on `projectsRouter`: `GET /` (→ `Project[]` by `createdAt asc`), `POST /` (201), `PATCH /:id`, `DELETE /:id` (204). Serialize dates → ISO.

- [ ] **Step 1: Write failing test `src/routes/projects.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";
const app = createApp();
beforeEach(async () => { await prisma.task.deleteMany(); await prisma.project.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("projects API", () => {
  it("creates, lists, updates, deletes", async () => {
    const c = await request(app).post("/projects").send({ name: "Web", color: "#4FA3D1" });
    expect(c.status).toBe(201);
    expect((await request(app).get("/projects")).body).toHaveLength(1);
    const u = await request(app).patch(`/projects/${c.body.id}`).send({ name: "Web v2" });
    expect(u.body.name).toBe("Web v2");
    expect((await request(app).delete(`/projects/${c.body.id}`)).status).toBe(204);
  });
  it("rejects bad color", async () => {
    expect((await request(app).post("/projects").send({ name: "x", color: "blue" })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @myschedule/api test src/routes/projects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/routes/projects.ts`**

```ts
import { Router } from "express";
import { createProjectSchema, updateProjectSchema } from "@myschedule/shared";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const projectsRouter = Router();

const ser = (p: { createdAt: Date; updatedAt: Date } & Record<string, unknown>) => ({
  ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
});

projectsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json((await prisma.project.findMany({ orderBy: { createdAt: "asc" } })).map(ser));
}));
projectsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  res.status(201).json(ser(await prisma.project.create({ data })));
}));
projectsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  res.json(ser(await prisma.project.update({ where: { id: req.params.id }, data })));
}));
projectsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @myschedule/api test src/routes/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): projects CRUD"
```

---

## Task 7: Labels API (TDD)

**Files:**
- Modify: `apps/api/src/routes/labels.ts`
- Test: `apps/api/src/routes/labels.test.ts`

**Interfaces:**
- Consumes: `prisma`, `asyncHandler`, shared `createLabelSchema`.
- Produces on `labelsRouter`: `GET /` (→ `Label[]` by `createdAt asc`), `POST /` (201), `DELETE /:id` (204).

- [ ] **Step 1: Write failing test `src/routes/labels.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";
const app = createApp();
beforeEach(async () => { await prisma.task.deleteMany(); await prisma.label.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("labels API", () => {
  it("creates, lists, deletes", async () => {
    const c = await request(app).post("/labels").send({ name: "bug", color: "#F4404A" });
    expect(c.status).toBe(201);
    expect((await request(app).get("/labels")).body[0].name).toBe("bug");
    expect((await request(app).delete(`/labels/${c.body.id}`)).status).toBe(204);
  });
  it("rejects empty name", async () => {
    expect((await request(app).post("/labels").send({ name: "" })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @myschedule/api test src/routes/labels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/routes/labels.ts`**

```ts
import { Router } from "express";
import { createLabelSchema } from "@myschedule/shared";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const labelsRouter = Router();

const ser = (l: { createdAt: Date } & Record<string, unknown>) => ({
  ...l, createdAt: l.createdAt.toISOString(),
});

labelsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json((await prisma.label.findMany({ orderBy: { createdAt: "asc" } })).map(ser));
}));
labelsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createLabelSchema.parse(req.body);
  res.status(201).json(ser(await prisma.label.create({ data })));
}));
labelsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.label.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @myschedule/api test`
Expected: PASS (whole api suite green).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): labels CRUD"
```

---

## Task 8: Web scaffold — Vite + Tailwind + shadcn + tokens + theme

**Files:**
- Create: `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/lib/utils.ts`, `src/components/theme/ThemeProvider.tsx`

**Interfaces:**
- Produces: a running Vite dev server rendering "MySchedule" with fonts + tokens + working light/dark toggle; `cn()` util; shadcn initialized; `VITE_API_URL` env wired.

- [ ] **Step 1: Create web app with Vite + install**

Run:
```bash
pnpm create vite@latest apps/web --template react-ts
pnpm --filter @myschedule/web add @myschedule/shared@workspace:* @tanstack/react-query @dnd-kit/core @dnd-kit/sortable cmdk class-variance-authority clsx tailwind-merge lucide-react
pnpm --filter @myschedule/web add -D tailwindcss postcss autoprefixer @types/node
```

- [ ] **Step 2: Set `apps/web/package.json` name + scripts**

Ensure `"name": "@myschedule/web"` and scripts include `"dev": "vite"`, `"build": "tsc -b && vite build"`, `"lint": "tsc --noEmit"`, `"test": "vitest run"` (vitest optional for web).

- [ ] **Step 3: Init Tailwind + shadcn**

Run:
```bash
pnpm --filter @myschedule/web exec tailwindcss init -p
pnpm --filter @myschedule/web dlx shadcn@latest init
```
Choose: TypeScript, default style, CSS variables yes, base color slate. This generates `components.json` + `lib/utils.ts`.

- [ ] **Step 4: Write `src/index.css` (tokens + fonts + heat ramp)**

```css
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg: #FAFAF8; --surface: #FFFFFF; --border: #E7E7E2;
    --ink: #1A1A18; --ink-muted: #6B6B64;
    --p-urgent: #F4404A; --p-high: #F5872B; --p-medium: #E0B341;
    --p-low: #4FA3D1; --p-none: #8A8A86;
    --font-display: "Space Grotesk", sans-serif;
    --font-body: "IBM Plex Sans", sans-serif;
    --font-mono: "IBM Plex Mono", monospace;
  }
  .dark {
    --bg: #131316; --surface: #1C1C21; --border: #2A2A30;
    --ink: #ECECEE; --ink-muted: #9A9AA0;
  }
  body {
    background: var(--bg); color: var(--ink);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }
  *:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 5: Map tokens in `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", border: "var(--border)",
        ink: { DEFAULT: "var(--ink)", muted: "var(--ink-muted)" },
        priority: {
          urgent: "var(--p-urgent)", high: "var(--p-high)", medium: "var(--p-medium)",
          low: "var(--p-low)", none: "var(--p-none)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"], body: ["var(--font-body)"], mono: ["var(--font-mono)"],
      },
      keyframes: { pulseSpine: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.55" } } },
      animation: { spine: "pulseSpine 2.4s ease-in-out infinite" },
    },
  },
} satisfies Config;
```

- [ ] **Step 6: Write `src/components/theme/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from "react";
type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 7: Write `src/main.tsx` + minimal `App.tsx`**

```tsx
// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import App from "./App";
import "./index.css";

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ThemeProvider><App /></ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

```tsx
// App.tsx  (placeholder; replaced in Task 10)
import { useTheme } from "./components/theme/ThemeProvider";
export default function App() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen p-8">
      <h1 className="font-display text-3xl font-bold">MySchedule</h1>
      <button className="font-mono text-sm mt-4 border border-border rounded px-3 py-1" onClick={toggle}>
        theme: {theme}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Create `apps/web/.env.example`**

```
VITE_API_URL=http://localhost:4000
```

- [ ] **Step 9: Run dev server and verify**

Run: `pnpm --filter @myschedule/web dev`
Expected: page shows "MySchedule" in Space Grotesk; theme button toggles light/dark (background + text colors change).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): vite + tailwind + shadcn scaffold with Signal tokens and theme"
```

---

## Task 9: API client + priority helpers + Query hooks

**Files:**
- Create: `src/lib/api.ts`, `src/lib/priority.ts`, `src/hooks/useTasks.ts`, `src/hooks/useProjects.ts`, `src/hooks/useLabels.ts`

**Interfaces:**
- Consumes: shared types `Task`, `Project`, `Label`, `CreateTaskInput`, `UpdateTaskInput`, `Status`, `Priority`.
- Produces:
  - `api.get/post/patch/del` typed fetch helpers (base = `import.meta.env.VITE_API_URL`).
  - `priorityMeta: Record<Priority, { label: string; color: string; glyph: string; rank: number }>`, `PRIORITY_ORDER: Priority[]`, `STATUS_ORDER: Status[]`, `statusMeta`.
  - `useTasks(filter?)`, `useCreateTask()`, `useUpdateTask()` (optimistic), `useDeleteTask()`.
  - `useProjects()`, `useCreateProject()`; `useLabels()`, `useCreateLabel()`.

- [ ] **Step 1: Write `src/lib/api.ts`**

```ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" }, ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body: unknown) => req<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) => req<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: (p: string) => req<void>(p, { method: "DELETE" }),
};
```

- [ ] **Step 2: Write `src/lib/priority.ts`**

```ts
import type { Priority, Status } from "@myschedule/shared";

export const priorityMeta: Record<Priority, { label: string; color: string; glyph: string; rank: number }> = {
  URGENT: { label: "Urgent", color: "var(--p-urgent)", glyph: "▲", rank: 0 },
  HIGH:   { label: "High",   color: "var(--p-high)",   glyph: "▮▮▮", rank: 1 },
  MEDIUM: { label: "Medium", color: "var(--p-medium)", glyph: "▮▮▯", rank: 2 },
  LOW:    { label: "Low",    color: "var(--p-low)",    glyph: "▮▯▯", rank: 3 },
  NONE:   { label: "No priority", color: "var(--p-none)", glyph: "▯▯▯", rank: 4 },
};
export const PRIORITY_ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];

export const statusMeta: Record<Status, { label: string }> = {
  BACKLOG: { label: "Backlog" }, TODO: { label: "Todo" },
  IN_PROGRESS: { label: "In Progress" }, DONE: { label: "Done" }, CANCELED: { label: "Canceled" },
};
export const STATUS_ORDER: Status[] = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED"];
```

- [ ] **Step 3: Write `src/hooks/useTasks.ts` (with optimistic update)**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, UpdateTaskInput, CreateTaskInput, TaskFilter } from "@myschedule/shared";
import { api } from "../lib/api";

const qs = (f?: TaskFilter) => {
  if (!f) return "";
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const tasksKey = (f?: TaskFilter) => ["tasks", f ?? {}] as const;

export function useTasks(filter?: TaskFilter) {
  return useQuery({ queryKey: tasksKey(filter), queryFn: () => api.get<Task[]>(`/tasks${qs(filter)}`) });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.post<Task>("/tasks", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) => api.patch<Task>(`/tasks/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      snapshots.forEach(([key, list]) => {
        if (!list) return;
        qc.setQueryData<Task[]>(key, list.map((t) => (t.id === id ? { ...t, ...patch } as Task : t)));
      });
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
```

- [ ] **Step 4: Write `src/hooks/useProjects.ts` + `src/hooks/useLabels.ts`**

```ts
// useProjects.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, CreateProjectInput } from "@myschedule/shared";
import { api } from "../lib/api";
export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => api.get<Project[]>("/projects") });
}
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: CreateProjectInput) => api.post<Project>("/projects", i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
```

```ts
// useLabels.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Label, CreateLabelInput } from "@myschedule/shared";
import { api } from "../lib/api";
export function useLabels() {
  return useQuery({ queryKey: ["labels"], queryFn: () => api.get<Label[]>("/labels") });
}
export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: CreateLabelInput) => api.post<Label>("/labels", i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labels"] }),
  });
}
```

- [ ] **Step 5: Verify it typechecks**

Run: `pnpm --filter @myschedule/web lint`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): api client, priority helpers, tanstack query hooks"
```

---

## Task 10: App shell — Sidebar, Topbar, view state

**Files:**
- Create: `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`
- Modify: `src/App.tsx`
- Add shadcn: `button`, `dialog`, `input`, `select`, `dropdown-menu`, `sheet`, `badge`, `popover`, `command`

**Interfaces:**
- Consumes: `useProjects`, `useLabels`, `useTheme`, `STATUS_ORDER`/`PRIORITY_ORDER`.
- Produces:
  - `type ViewMode = "board" | "list"`, `type GroupBy = "status" | "priority"` lifted in `App`.
  - `<Sidebar projects labels selectedProjectId onSelectProject />`
  - `<Topbar view onView groupBy onGroupBy onNewTask onOpenPalette />`
  - App renders Sidebar + Topbar + a content slot (BoardView/ListView wired in Tasks 11–12).

- [ ] **Step 1: Add shadcn components**

Run:
```bash
pnpm --filter @myschedule/web dlx shadcn@latest add button dialog input select dropdown-menu sheet badge popover command textarea calendar
```

- [ ] **Step 2: Write `src/components/layout/Sidebar.tsx`**

```tsx
import { useProjects } from "../../hooks/useProjects";
import { useLabels } from "../../hooks/useLabels";
import { cn } from "../../lib/utils";

export function Sidebar({ selectedProjectId, onSelectProject }: {
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
}) {
  const { data: projects = [] } = useProjects();
  const { data: labels = [] } = useLabels();
  return (
    <aside className="w-60 shrink-0 border-r border-border h-screen p-4 flex flex-col gap-6 bg-surface">
      <div className="font-display text-lg font-bold tracking-tight">MySchedule</div>
      <nav className="text-sm">
        <button onClick={() => onSelectProject(null)}
          className={cn("w-full text-left px-2 py-1 rounded hover:bg-bg", !selectedProjectId && "bg-bg font-medium")}>
          All tasks
        </button>
      </nav>
      <div>
        <div className="font-mono text-xs uppercase text-ink-muted mb-2">Projects</div>
        <ul className="text-sm space-y-1">
          {projects.map((p) => (
            <li key={p.id}>
              <button onClick={() => onSelectProject(p.id)}
                className={cn("w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-bg", selectedProjectId === p.id && "bg-bg font-medium")}>
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-mono text-xs uppercase text-ink-muted mb-2">Labels</div>
        <ul className="text-sm space-y-1">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-2 py-1">
              <span className="size-2 rounded-sm" style={{ background: l.color }} />{l.name}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Write `src/components/layout/Topbar.tsx`**

```tsx
import { Moon, Sun, Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import { useTheme } from "../theme/ThemeProvider";
import { cn } from "../../lib/utils";

export type ViewMode = "board" | "list";
export type GroupBy = "status" | "priority";

export function Topbar({ view, onView, groupBy, onGroupBy, onNewTask, onOpenPalette }: {
  view: ViewMode; onView: (v: ViewMode) => void;
  groupBy: GroupBy; onGroupBy: (g: GroupBy) => void;
  onNewTask: () => void; onOpenPalette: () => void;
}) {
  const { theme, toggle } = useTheme();
  const seg = (active: boolean) => cn("px-3 py-1 text-sm rounded-md font-mono", active ? "bg-ink text-bg" : "text-ink-muted hover:text-ink");
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 gap-4 bg-surface">
      <div className="flex items-center gap-1">
        <button className={seg(view === "board")} onClick={() => onView("board")}>Board</button>
        <button className={seg(view === "list")} onClick={() => onView("list")}>List</button>
      </div>
      <div className="flex items-center gap-3">
        {view === "board" && (
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <button className={seg(groupBy === "status")} onClick={() => onGroupBy("status")}>Status</button>
            <button className={seg(groupBy === "priority")} onClick={() => onGroupBy("priority")}>Priority</button>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onOpenPalette} aria-label="Search (Cmd+K)"><Search className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button onClick={onNewTask} className="gap-1"><Plus className="size-4" /> New</Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Rewrite `src/App.tsx` to compose the shell**

```tsx
import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar, type ViewMode, type GroupBy } from "./components/layout/Topbar";

export default function App() {
  const [view, setView] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex">
      <Sidebar selectedProjectId={projectId} onSelectProject={setProjectId} />
      <main className="flex-1 h-screen flex flex-col">
        <Topbar view={view} onView={setView} groupBy={groupBy} onGroupBy={setGroupBy}
          onNewTask={() => setCreateOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        <section className="flex-1 overflow-auto p-4">
          {/* BoardView / ListView wired in Tasks 11-12 */}
          <p className="font-mono text-sm text-ink-muted">view={view} group={groupBy} project={projectId ?? "all"}</p>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Run dev + visually verify shell**

Run: `pnpm --filter @myschedule/web dev`
Expected: sidebar with MySchedule wordmark, projects/labels sections; topbar with Board/List + Status/Priority toggles, theme + New buttons. Toggles update the debug line.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): app shell with sidebar, topbar, view/group state"
```

---

## Task 11: Board view — columns, task cards, heat-spine, drag & drop

**Files:**
- Create: `src/components/board/BoardView.tsx`, `src/components/board/Column.tsx`, `src/components/board/TaskCard.tsx`
- Modify: `src/App.tsx` (render `BoardView` when `view === "board"`)

**Interfaces:**
- Consumes: `useTasks`, `useUpdateTask`, `priorityMeta`, `STATUS_ORDER`, `PRIORITY_ORDER`, `statusMeta`, dnd-kit.
- Produces:
  - `<TaskCard task onClick />` — card with left heat-spine (`priorityMeta[task.priority].color`), Urgent gets `animate-spine`; shows mono task-id-ish (use `task.id.slice(0,6)`), title, due date (mono), label dots, priority glyph.
  - `<Column id title accent count>` droppable column.
  - `<BoardView groupBy projectId onOpenTask />` — groups tasks, renders columns, handles `DragEndEvent` → computes new `sortOrder` (midpoint) and the grouped field (`status` or `priority`) → `useUpdateTask`.

- [ ] **Step 1: Write `src/components/board/TaskCard.tsx`**

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@myschedule/shared";
import { priorityMeta } from "../../lib/priority";

export function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const meta = priorityMeta[task.priority];
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={onClick}
      className="relative bg-surface border border-border rounded-lg p-3 pl-4 cursor-grab active:cursor-grabbing hover:border-ink/30">
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${task.priority === "URGENT" ? "animate-spine" : ""}`}
        style={{ background: meta.color }} aria-hidden />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-ink-muted">{task.id.slice(0, 6)}</span>
        <span className="font-mono text-[11px]" style={{ color: meta.color }} title={meta.label}>{meta.glyph}</span>
      </div>
      <p className="text-sm mt-1 leading-snug">{task.title}</p>
      <div className="flex items-center gap-2 mt-2">
        {task.dueDate && (
          <span className="font-mono text-[11px] text-ink-muted">
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        {task.labels.map((l) => (
          <span key={l.id} className="size-2 rounded-sm" style={{ background: l.color }} title={l.name} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/board/Column.tsx`**

```tsx
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task } from "@myschedule/shared";
import { TaskCard } from "./TaskCard";

export function Column({ id, title, accent, tasks, onOpenTask }: {
  id: string; title: string; accent: string; tasks: Task[]; onOpenTask: (t: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-1 border-b-2" style={{ borderColor: accent }}>
        <span className="font-display text-sm font-semibold">{title}</span>
        <span className="font-mono text-xs text-ink-muted">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 min-h-24">
          {tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t)} />)}
        </div>
      </SortableContext>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/board/BoardView.tsx`**

```tsx
import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Task, Status, Priority, TaskFilter } from "@myschedule/shared";
import { useTasks, useUpdateTask } from "../../hooks/useTasks";
import { STATUS_ORDER, PRIORITY_ORDER, statusMeta, priorityMeta } from "../../lib/priority";
import { Column } from "./Column";
import type { GroupBy } from "../layout/Topbar";

export function BoardView({ groupBy, projectId, onOpenTask }: {
  groupBy: GroupBy; projectId: string | null; onOpenTask: (t: Task) => void;
}) {
  const filter: TaskFilter | undefined = projectId ? { projectId } : undefined;
  const { data: tasks = [] } = useTasks(filter);
  const update = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const groups = groupBy === "status" ? STATUS_ORDER : PRIORITY_ORDER;
  const colInfo = (key: string) =>
    groupBy === "status"
      ? { title: statusMeta[key as Status].label, accent: "var(--border)" }
      : { title: priorityMeta[key as Priority].label, accent: priorityMeta[key as Priority].color };

  const byGroup = (key: string) =>
    tasks.filter((t) => (groupBy === "status" ? t.status : t.priority) === key)
         .sort((a, b) => a.sortOrder - b.sortOrder);

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const task = tasks.find((t) => t.id === activeId);
    if (!task || !e.over) return;
    const overId = String(e.over.id);

    // over a column container id (group key) or another card
    const overTask = tasks.find((t) => t.id === overId);
    const targetGroup = overTask ? (groupBy === "status" ? overTask.status : overTask.priority) : (overId as Status | Priority);
    const column = byGroup(targetGroup).filter((t) => t.id !== activeId);

    const idx = overTask ? column.findIndex((t) => t.id === overTask.id) : column.length;
    const before = column[idx - 1]?.sortOrder ?? (column[0] ? column[0].sortOrder - 1 : 0);
    const after = column[idx]?.sortOrder ?? before + 2;
    const sortOrder = (before + after) / 2;

    const patch = groupBy === "status"
      ? { status: targetGroup as Status, sortOrder }
      : { priority: targetGroup as Priority, sortOrder };
    update.mutate({ id: activeId, patch });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-4 h-full">
        {groups.map((key) => {
          const info = colInfo(key);
          return <Column key={key} id={key} title={info.title} accent={info.accent}
            tasks={byGroup(key)} onOpenTask={onOpenTask} />;
        })}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 4: Wire `BoardView` into `App.tsx`**

Replace the placeholder `<section>` content:
```tsx
{view === "board"
  ? <BoardView groupBy={groupBy} projectId={projectId} onOpenTask={setOpenTask} />
  : null /* ListView in Task 12 */}
```
Add state `const [openTask, setOpenTask] = useState<Task | null>(null);` and import `BoardView` + `Task` type. (TaskDetailDrawer consumes `openTask` in Task 13.)

- [ ] **Step 5: Run dev + verify drag**

Run start the API (`pnpm --filter @myschedule/api dev`) and web. Create a couple tasks via the API (or wait for Task 13's modal). Verify columns render per grouping, heat-spines show priority colors, Urgent spine pulses, and dragging a card to another column persists (status/priority changes; survives refresh).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): board view with heat-spine cards and drag-and-drop reordering"
```

---

## Task 12: List view

**Files:**
- Create: `src/components/list/ListView.tsx`
- Modify: `src/App.tsx` (render when `view === "list"`)

**Interfaces:**
- Consumes: `useTasks`, `priorityMeta`, `statusMeta`.
- Produces: `<ListView projectId onOpenTask />` — a dense table grouped by status with mono metadata columns (id, priority glyph, due date), sorted by priority rank then sortOrder.

- [ ] **Step 1: Write `src/components/list/ListView.tsx`**

```tsx
import type { Task, TaskFilter } from "@myschedule/shared";
import { useTasks } from "../../hooks/useTasks";
import { priorityMeta, statusMeta, STATUS_ORDER } from "../../lib/priority";

export function ListView({ projectId, onOpenTask }: { projectId: string | null; onOpenTask: (t: Task) => void }) {
  const filter: TaskFilter | undefined = projectId ? { projectId } : undefined;
  const { data: tasks = [] } = useTasks(filter);

  return (
    <div className="max-w-4xl mx-auto">
      {STATUS_ORDER.map((status) => {
        const rows = tasks.filter((t) => t.status === status)
          .sort((a, b) => priorityMeta[a.priority].rank - priorityMeta[b.priority].rank || a.sortOrder - b.sortOrder);
        if (rows.length === 0) return null;
        return (
          <div key={status} className="mb-6">
            <div className="font-display text-sm font-semibold mb-2 text-ink-muted">
              {statusMeta[status].label} <span className="font-mono text-xs">{rows.length}</span>
            </div>
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {rows.map((t) => {
                const m = priorityMeta[t.priority];
                return (
                  <button key={t.id} onClick={() => onOpenTask(t)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface">
                    <span className="font-mono text-[11px]" style={{ color: m.color }} title={m.label}>{m.glyph}</span>
                    <span className="font-mono text-[11px] text-ink-muted w-14">{t.id.slice(0, 6)}</span>
                    <span className="text-sm flex-1">{t.title}</span>
                    {t.labels.map((l) => <span key={l.id} className="size-2 rounded-sm" style={{ background: l.color }} title={l.name} />)}
                    {t.dueDate && <span className="font-mono text-[11px] text-ink-muted">
                      {new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `App.tsx`**

```tsx
{view === "board"
  ? <BoardView groupBy={groupBy} projectId={projectId} onOpenTask={setOpenTask} />
  : <ListView projectId={projectId} onOpenTask={setOpenTask} />}
```

- [ ] **Step 3: Run dev + verify**

Expected: List view groups by status; rows show priority glyph, short id, title, labels, due date in mono. Clicking a row will open the drawer (Task 13).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): dense list view grouped by status"
```

---

## Task 13: Quick-create modal + task detail drawer

**Files:**
- Create: `src/components/task/QuickCreateDialog.tsx`, `src/components/task/TaskDetailDrawer.tsx`
- Modify: `src/App.tsx` (mount both, pass open state)

**Interfaces:**
- Consumes: `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useProjects`, `useLabels`, shared enums + `priorityMeta`/`statusMeta`, shadcn `dialog`/`sheet`/`input`/`textarea`/`select`/`button`.
- Produces:
  - `<QuickCreateDialog open onOpenChange defaultProjectId />` — fields: title (autofocus), status, priority, project, due date, labels. Submits via `useCreateTask`.
  - `<TaskDetailDrawer task open onOpenChange />` — edit all fields (incl. markdown description textarea) via `useUpdateTask`; delete button via `useDeleteTask`.

- [ ] **Step 1: Write `src/components/task/QuickCreateDialog.tsx`**

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { statusEnum, priorityEnum, type Status, type Priority } from "@myschedule/shared";
import { statusMeta, priorityMeta } from "../../lib/priority";
import { useCreateTask } from "../../hooks/useTasks";
import { useProjects } from "../../hooks/useProjects";

export function QuickCreateDialog({ open, onOpenChange, defaultProjectId }: {
  open: boolean; onOpenChange: (o: boolean) => void; defaultProjectId: string | null;
}) {
  const create = useCreateTask();
  const { data: projects = [] } = useProjects();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("BACKLOG");
  const [priority, setPriority] = useState<Priority>("NONE");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "none");
  const [dueDate, setDueDate] = useState("");

  function submit() {
    if (!title.trim()) return;
    create.mutate(
      { title: title.trim(), status, priority,
        projectId: projectId === "none" ? null : projectId,
        dueDate: dueDate || null },
      { onSuccess: () => { setTitle(""); setDueDate(""); onOpenChange(false); } },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface">
        <DialogHeader><DialogTitle className="font-display">New task</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Task title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statusEnum.options.map((s) => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{priorityEnum.options.map((p) => <SelectItem key={p} value={p}>{priorityMeta[p].label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={!title.trim() || create.isPending}>Create task</Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write `src/components/task/TaskDetailDrawer.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { statusEnum, priorityEnum, type Task, type Status, type Priority } from "@myschedule/shared";
import { statusMeta, priorityMeta } from "../../lib/priority";
import { useUpdateTask, useDeleteTask } from "../../hooks/useTasks";

export function TaskDetailDrawer({ task, open, onOpenChange }: {
  task: Task | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => { if (task) { setTitle(task.title); setDescription(task.description ?? ""); } }, [task]);
  if (!task) return null;

  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => update.mutate({ id: task.id, patch });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-surface w-[420px] sm:max-w-none flex flex-col gap-4">
        <SheetHeader><SheetTitle className="font-mono text-xs text-ink-muted">{task.id.slice(0, 6)}</SheetTitle></SheetHeader>
        <Input className="font-display text-lg" value={title}
          onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && save({ title: title.trim() })} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={task.status} onValueChange={(v) => save({ status: v as Status })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statusEnum.options.map((s) => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={task.priority} onValueChange={(v) => save({ priority: v as Priority })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{priorityEnum.options.map((p) => <SelectItem key={p} value={p}>{priorityMeta[p].label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea className="min-h-40 font-mono text-sm" placeholder="Description (markdown)"
          value={description} onChange={(e) => setDescription(e.target.value)}
          onBlur={() => save({ description: description || null })} />
        <Button variant="destructive" className="mt-auto"
          onClick={() => del.mutate(task.id, { onSuccess: () => onOpenChange(false) })}>Delete task</Button>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Mount both in `App.tsx`**

```tsx
<QuickCreateDialog open={createOpen} onOpenChange={setCreateOpen} defaultProjectId={projectId} />
<TaskDetailDrawer task={openTask} open={!!openTask} onOpenChange={(o) => !o && setOpenTask(null)} />
```

- [ ] **Step 4: Run dev + verify full loop**

Expected: "New" opens dialog; creating a task makes it appear on the board (optimistic/refetch). Clicking a card opens the drawer; changing status/priority moves it; editing title/description persists on blur; delete removes it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): quick-create dialog and task detail drawer"
```

---

## Task 14: Command palette (⌘K) + keyboard shortcuts

**Files:**
- Create: `src/components/command/CommandPalette.tsx`
- Modify: `src/App.tsx` (mount palette; global key handler)

**Interfaces:**
- Consumes: shadcn `command` (cmdk), `useTasks`, action callbacks from App (open create, switch view/group, open task).
- Produces:
  - `<CommandPalette open onOpenChange actions tasks onOpenTask />` with groups: Actions (New task, Board, List, Group by status, Group by priority, Toggle theme) and Tasks (searchable, jump → open drawer).
  - Global shortcuts in App: `⌘K`/`Ctrl+K` toggle palette; `C` new task; `/` open palette in search; ignored while typing in inputs.

- [ ] **Step 1: Write `src/components/command/CommandPalette.tsx`**

```tsx
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import type { Task } from "@myschedule/shared";

export type PaletteActions = {
  newTask: () => void; board: () => void; list: () => void;
  groupStatus: () => void; groupPriority: () => void; toggleTheme: () => void;
};

export function CommandPalette({ open, onOpenChange, actions, tasks, onOpenTask }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  actions: PaletteActions; tasks: Task[]; onOpenTask: (t: Task) => void;
}) {
  const run = (fn: () => void) => { fn(); onOpenChange(false); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search tasks…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(actions.newTask)}>New task</CommandItem>
          <CommandItem onSelect={() => run(actions.board)}>Go to Board</CommandItem>
          <CommandItem onSelect={() => run(actions.list)}>Go to List</CommandItem>
          <CommandItem onSelect={() => run(actions.groupStatus)}>Group by status</CommandItem>
          <CommandItem onSelect={() => run(actions.groupPriority)}>Group by priority</CommandItem>
          <CommandItem onSelect={() => run(actions.toggleTheme)}>Toggle theme</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Tasks">
          {tasks.map((t) => (
            <CommandItem key={t.id} value={`${t.id} ${t.title}`} onSelect={() => run(() => onOpenTask(t))}>
              <span className="font-mono text-[11px] text-ink-muted mr-2">{t.id.slice(0, 6)}</span>{t.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Add global shortcuts + mount palette in `App.tsx`**

```tsx
import { useEffect } from "react";
import { useTheme } from "./components/theme/ThemeProvider";
import { CommandPalette } from "./components/command/CommandPalette";
import { useTasks } from "./hooks/useTasks";

// inside App():
const { toggle } = useTheme();
const { data: allTasks = [] } = useTasks(projectId ? { projectId } : undefined);

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName) ||
      (e.target as HTMLElement)?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); return; }
    if (typing) return;
    if (e.key === "c") { e.preventDefault(); setCreateOpen(true); }
    if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

And mount:
```tsx
<CommandPalette
  open={paletteOpen} onOpenChange={setPaletteOpen}
  tasks={allTasks} onOpenTask={(t) => { setOpenTask(t); setPaletteOpen(false); }}
  actions={{
    newTask: () => setCreateOpen(true),
    board: () => setView("board"), list: () => setView("list"),
    groupStatus: () => setGroupBy("status"), groupPriority: () => setGroupBy("priority"),
    toggleTheme: toggle,
  }} />
```

- [ ] **Step 3: Run dev + verify shortcuts**

Expected: ⌘K (or Ctrl+K) opens/closes palette; `C` opens new-task dialog; `/` opens palette; typing in an input does not trigger shortcuts; selecting a task opens its drawer; action items switch view/group/theme.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): command palette and keyboard shortcuts"
```

---

## Task 15: Deployment config + README

**Files:**
- Create: `apps/api/render.yaml` (or document settings), `apps/web/vercel.json`, root `README.md`
- Modify: `PLAN.md` (check off completed MVP items)

**Interfaces:**
- Produces: documented, reproducible deploys — API on Render (build with pnpm, `prisma migrate deploy`, start `node dist/index.js`), web on Vercel (root `apps/web`, build outputs `dist`), env vars listed.

- [ ] **Step 1: Write `apps/api/render.yaml`**

```yaml
services:
  - type: web
    name: myschedule-api
    runtime: node
    rootDir: apps/api
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm --filter @myschedule/api prisma generate && pnpm --filter @myschedule/api build && pnpm --filter @myschedule/api prisma migrate deploy
    startCommand: node dist/index.js
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: PORT
        value: 10000
```

> Note: Render runs the build from repo root by default; if `rootDir` causes pnpm workspace resolution issues, set `rootDir` to repo root and prefix commands with `--filter @myschedule/api`. Document whichever the deploy verifies.

- [ ] **Step 2: Write `apps/web/vercel.json`**

```json
{
  "buildCommand": "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @myschedule/web build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

> On Vercel: set Project Root Directory = `apps/web`, and env `VITE_API_URL` = deployed Render API URL. Enable CORS already handled by `cors()` in the API.

- [ ] **Step 3: Write root `README.md`**

Document: prerequisites (Node 20, pnpm, a Postgres/Neon URL), local setup (`pnpm install`, set `apps/api/.env`, `pnpm --filter @myschedule/api prisma migrate dev`, `pnpm dev`), test (`pnpm test`), and deploy steps for Render (API) + Vercel (web) with required env vars.

- [ ] **Step 4: Check off completed items in `PLAN.md` Phase 1**

Mark each delivered MVP checkbox `- [x]`.

- [ ] **Step 5: Full verification**

Run: `pnpm install && pnpm -r build && pnpm test`
Expected: all workspaces build; shared + api test suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: deployment config, README, update PLAN progress"
```

---

## Self-Review Notes

- **Spec coverage:** auth-none (single implicit workspace, Task 3); Board+List+grouping toggle (Tasks 10–12); task fields incl. labels/due/project (Tasks 2,4,5); ⌘K + shortcuts + quick-create + dark mode (Tasks 8,10,13,14); Prisma/Postgres/Neon (Task 4); Zod-shared contract (Task 2); error shape (Task 3); REST endpoints (Tasks 5–7); optimistic drag (Tasks 9,11); Vitest on shared+api (Tasks 2,3,5–7); heat-spine + tokens + fonts (Tasks 8,11); separate deploys (Task 15). No gaps found.
- **Type consistency:** `serializeTask` shape matches shared `taskSchema` (dates as ISO strings, `labels: {id,name,color}[]`); `useUpdateTask` patch type = `UpdateTaskInput`; `priorityMeta`/`statusMeta`/`*_ORDER` names consistent across Tasks 9, 11, 12, 13.
- **Placeholders:** none — the only intentional stubs (empty routers in Task 3) are filled by Tasks 5–7 and called out explicitly.
