# MySchedule — Prioritization Board (MVP) Design

**Date:** 2026-06-18
**Status:** Approved
**Scope:** First sub-project of the larger MySchedule vision — a Linear-style task prioritization board. Future subsystems (project planning, docs, mobile app, collaboration) are tracked in `PLAN.md` and each gets its own design cycle.

## 1. Goal

Build a single-user, no-auth web app that clones the core feel of Linear's issue board: fast, keyboard-driven task management with drag-and-drop prioritization. Deployed on free-tier infrastructure with frontend and backend hosted separately.

## 2. Decisions Locked

- **Auth:** None. Single implicit user/workspace. (Auth is a future phase.)
- **Board axis:** Both — toggle grouping between **Status** and **Priority**, plus a **List** view.
- **Task fields:** title, description (markdown), status, priority, created/updated timestamps, labels (color-coded, many-to-many), optional due date, optional Project grouping.
- **UX polish (all in MVP):** ⌘K command palette, keyboard shortcuts, quick-create modal, dark mode.
- **ORM:** Prisma.

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Light, cached builds, deploys cleanly from subdirs |
| Shared | `packages/shared` — Zod schemas + TS types | Single source of truth for the API contract |
| Backend | Express + TypeScript, Zod validation | As specified; runtime validation + shared types |
| ORM | Prisma | Best DX, migrations, type-safe client |
| DB host | Neon (serverless Postgres) | Free tier, pooled connections, works with Render + Vercel |
| Frontend | React + Vite + TypeScript, shadcn/ui, Tailwind | Fast dev, shadcn component system |
| Data fetching | TanStack Query | Caching + optimistic updates for snappy drag-drop |
| Drag & drop | dnd-kit | Modern, accessible |
| Command palette | cmdk (ships with shadcn) | ⌘K menu |
| Testing | Vitest | Shared schema + API route handler tests |
| Deploy | Web → Vercel, API → Render, DB → Neon | All free tier, separate deploys |

## 4. Repo Layout

```
MySchedule/
├── apps/
│   ├── web/          # React + Vite + shadcn/ui  → Vercel
│   └── api/          # Express + TS + Prisma      → Render
├── packages/
│   └── shared/       # Zod schemas + TS types (API contract)
├── package.json      # pnpm workspaces root
├── turbo.json
└── PLAN.md
```

Data flow: `web` (TanStack Query) → REST/JSON → `api` (Express) → Prisma → Neon Postgres. Both ends import Zod schemas from `shared` so the contract cannot drift.

## 5. Data Model (Prisma)

```
Project   id, name, color, createdAt, updatedAt
Label     id, name, color, createdAt
Task      id, title, description (text/markdown nullable),
          status   enum(BACKLOG, TODO, IN_PROGRESS, DONE, CANCELED),
          priority enum(NONE, LOW, MEDIUM, HIGH, URGENT),
          dueDate (nullable),
          projectId (FK Project, nullable),
          sortOrder (float — stable ordering within a column),
          createdAt, updatedAt
TaskLabel  (Task <-> Label many-to-many join)
```

`sortOrder` is a float: dropping a card between two neighbors sets it to the midpoint of their sortOrder values, avoiding mass renumbering. Periodic/normalization rebalance is a future concern (out of MVP).

## 6. REST API

- `GET /tasks` — supports filters: `?status=&priority=&projectId=&labelId=`
- `POST /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id` — also handles status / priority / sortOrder changes from drag-drop
- `DELETE /tasks/:id`
- `GET /projects`, `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`
- `GET /labels`, `POST /labels`, `DELETE /labels/:id`

All request bodies validated with shared Zod schemas. Consistent error shape: `{ error: { message, details? } }`.

## 7. Frontend

- **Layout:** left sidebar (Views + Projects list + Labels) and main content area.
- **Views:** Board (grouping toggle: Status ↔ Priority) and List view.
- **Board:** dnd-kit columns; drag updates status/priority + sortOrder with **optimistic** TanStack Query mutations (instant UI, reconciles on server response, rolls back on error).
- **⌘K command palette (cmdk):** create task, switch view, navigate, search tasks.
- **Keyboard shortcuts:** `C` new task, `/` search, arrow keys to navigate cards.
- **Quick-create modal:** title + status/priority/project/labels/due date.
- **Task detail:** side drawer for full edit including markdown description.
- **Dark mode:** shadcn theme toggle, persisted to localStorage.

## 8. Error Handling

- **API:** Zod validation failure → 400 with `details`; Prisma record-not-found → 404; central Express error middleware → 500.
- **Web:** TanStack Query loading/error states; optimistic mutations roll back on failure and surface a toast.

## 9. Testing

- Vitest for `shared` schema validation and `api` route handler logic (highest-value coverage for the MVP).
- Heavy end-to-end testing deferred.

## 10. Out of MVP (tracked in PLAN.md "Future")

Auth / multi-user / teams / workspaces, real-time collaboration, comments, sub-tasks, cycles/sprints, attachments, notifications, mobile app, Notion-style docs/wiki, saved filters / custom views, activity history, search ranking.
