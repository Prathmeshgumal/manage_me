# MySchedule — Project Plan

A self-hosted task & project planning tool — our own take on Notion/Linear. Web portal first, mobile app later. Built as a monorepo with separately deployed frontend (Vercel) and backend (Render), backed by Postgres (Neon).

## Vision

A fast, keyboard-driven workspace for personal task planning, project planning, and prioritization — growing over time toward a Notion/Linear-class tool.

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** React + Vite + TypeScript, shadcn/ui, Tailwind, TanStack Query, dnd-kit, cmdk → Vercel
- **Backend:** Express + TypeScript, Prisma, Zod → Render
- **Shared:** `packages/shared` — Zod schemas + TS types (API contract)
- **Database:** Postgres on Neon
- **Testing:** Vitest

---

## Phase 1 — Prioritization Board (MVP) — IN PROGRESS

> Full design: `docs/superpowers/specs/2026-06-18-prioritization-board-design.md`

Single-user, no auth. Clone the core feel of Linear's issue board.

- [ ] Monorepo scaffold (pnpm + Turborepo, `apps/web`, `apps/api`, `packages/shared`)
- [ ] Postgres + Prisma schema: Task, Project, Label, TaskLabel
- [ ] REST API: tasks (CRUD + filter), projects (CRUD), labels (CRUD), Zod validation, error middleware
- [ ] Shared Zod schemas / TS types consumed by both ends
- [ ] Frontend shell: sidebar + main area, shadcn/ui, dark mode toggle
- [ ] Board view with **Status ↔ Priority** grouping toggle
- [ ] List view
- [ ] Drag & drop (dnd-kit) with optimistic updates + `sortOrder`
- [ ] Task fields: title, markdown description, status, priority, due date, labels, project
- [ ] Quick-create modal
- [ ] Task detail side drawer
- [ ] ⌘K command palette
- [ ] Keyboard shortcuts (C / `/` / arrows)
- [ ] Vitest coverage for shared schemas + API handlers
- [ ] Deploy: web → Vercel, api → Render, db → Neon

---

## Future Phases (planned, not yet designed)

Each gets its own design + plan cycle when we reach it.

### Phase 2 — Accounts & Multi-user
- Auth (email/password or OAuth), sessions
- Per-user data isolation, then workspaces/teams & sharing

### Phase 3 — Richer Task Management
- Comments & activity history
- Sub-tasks / checklists
- Attachments
- Saved filters & custom views
- Full-text search with ranking
- Cycles / sprints

### Phase 4 — Project Planning
- Project pages with milestones, progress, timeline/roadmap views
- Project-level priorities and grouping

### Phase 5 — Notion-style Docs
- Rich document/wiki editor, nested pages, linking docs to tasks/projects

### Phase 6 — Collaboration & Notifications
- Real-time updates (websockets)
- Notifications (in-app + email)

### Phase 7 — Mobile App
- Native or cross-platform app consuming the same API

---

## Out of Scope (for now)

Billing, third-party integrations (Slack/GitHub), AI features, public sharing/embeds. Revisit after core phases land.
