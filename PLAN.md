# MySchedule — Project Plan

A self-hosted task & project planning tool — our own take on Notion/Linear. Web portal first, mobile app later. Two independent projects in one repo — `frontend/` (Vercel) and `backend/` (Render) — backed by Postgres (Neon).

## Vision

A fast, keyboard-driven workspace for personal task planning, project planning, and prioritization — growing over time toward a Notion/Linear-class tool.

## Tech Stack

- **Structure:** two standalone projects — `frontend/` and `backend/` (each its own package + lockfile)
- **Frontend:** React + Vite + TypeScript, shadcn/ui, Tailwind, TanStack Query, dnd-kit, cmdk → Vercel
- **Backend:** Express + TypeScript, Prisma, Zod → Render
- **API contract:** types in `frontend/src/types.ts` + `backend/src/schemas.ts` (kept in sync)
- **Database:** Postgres on Neon
- **Testing:** Vitest

---

## Phase 1 — Prioritization Board (MVP) — ✅ COMPLETE

> Full design: `docs/superpowers/specs/2026-06-18-prioritization-board-design.md`

Single-user, no auth. Clone the core feel of Linear's issue board.

- [x] Project scaffold (standalone `frontend/` + `backend/`)
- [x] Postgres + Prisma schema: Task, Project, Label, TaskLabel
- [x] REST API: tasks (CRUD + filter), projects (CRUD), labels (CRUD), Zod validation, error middleware
- [x] Typed API contract (`backend/src/schemas.ts` + `frontend/src/types.ts`)
- [x] Frontend shell: sidebar + main area, shadcn/ui, dark mode toggle
- [x] Board view with **Status ↔ Priority** grouping toggle
- [x] List view
- [x] Drag & drop (dnd-kit) with optimistic updates + `sortOrder`
- [x] Task fields: title, markdown description, status, priority, due date, labels, project
- [x] Quick-create modal
- [x] Task detail side drawer
- [x] ⌘K command palette
- [x] Keyboard shortcuts (C / `/` / arrows)
- [x] Vitest coverage for shared schemas + API handlers
- [x] Deploy: web → Vercel, api → Render, db → Neon

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
