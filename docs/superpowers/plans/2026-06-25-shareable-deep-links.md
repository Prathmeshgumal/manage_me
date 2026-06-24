# Shareable Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a copy-link button to every page (and to tasks, books, wishlist items) producing hash URLs that, when pasted into rendered markdown, navigate in-place without reload.

**Architecture:** A pure routing module (`lib/appRoute.ts`) owns all URL knowledge. `App.tsx` syncs view state ↔ `location.hash` (parse on load/`hashchange`; write via `replaceState`). The shared `Markdown` renderer turns internal links into in-tab anchors so a hash change navigates instantly. A reusable `CopyLinkButton` copies the current (or an explicit) link.

**Tech Stack:** React + TypeScript, @tanstack/react-query, lucide-react, Tailwind. Frontend-only — no backend changes (all deep-link GET endpoints already exist).

## Global Constraints

- **Frontend-only.** No backend or DB changes.
- **No new test runner.** The repo has no frontend test framework; do NOT add one. Each task is verified with `pnpm lint` (runs `tsc -p tsconfig.app.json --noEmit`) and, where noted, `pnpm build`, plus the manual smoke checklist in Task 6. Run all `pnpm` commands from `/home/deepstack/MySchedule/frontend`.
- **Hash URLs only** (`#/…`); never path-based.
- **Commit messages:** no AI attribution (no "Co-Authored-By", no "Generated with Claude").
- Branch is `feat/shareable-deep-links` (already created).
- Unrecognized/empty hash resolves to the `tasks` route.

---

### Task 1: Routing module (`lib/appRoute.ts`)

**Files:**
- Create: `frontend/src/lib/appRoute.ts`

**Interfaces:**
- Produces:
  - `type Route` (discriminated union, `kind` of: `tasks`, `project`, `project-settings`, `task`, `library`, `book`, `wishlists`, `wishlist`, `wishlist-item`, `lists`, `settings`; id-bearing variants carry `id: string`).
  - `routeToHash(route: Route): string`
  - `parseHash(hash: string): Route | null`
  - `routeToLink(route: Route): string`
  - `isInternalLink(href: string): boolean`

- [ ] **Step 1: Create the module**

Create `frontend/src/lib/appRoute.ts`:

```ts
// Single source of truth for the app's shareable URL scheme (hash-based).
// Everything else (App routing, markdown links, copy buttons) calls into here.

export type Route =
  | { kind: "tasks" }
  | { kind: "project"; id: string }
  | { kind: "project-settings"; id: string }
  | { kind: "task"; id: string }
  | { kind: "library" }
  | { kind: "book"; id: string }
  | { kind: "wishlists" }
  | { kind: "wishlist"; id: string }
  | { kind: "wishlist-item"; id: string }
  | { kind: "lists" }
  | { kind: "settings" };

export function routeToHash(route: Route): string {
  switch (route.kind) {
    case "tasks": return "#/tasks";
    case "project": return `#/projects/${route.id}`;
    case "project-settings": return `#/projects/${route.id}/settings`;
    case "task": return `#/task/${route.id}`;
    case "library": return "#/library";
    case "book": return `#/books/${route.id}`;
    case "wishlists": return "#/wishlists";
    case "wishlist": return `#/wishlists/${route.id}`;
    case "wishlist-item": return `#/wishlist-items/${route.id}`;
    case "lists": return "#/lists";
    case "settings": return "#/settings";
  }
}

export function parseHash(hash: string): Route | null {
  const parts = hash.replace(/^#/, "").replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const [a, b, c] = parts;
  switch (a) {
    case "tasks": return parts.length === 1 ? { kind: "tasks" } : null;
    case "task": return b && parts.length === 2 ? { kind: "task", id: b } : null;
    case "projects":
      if (b && parts.length === 2) return { kind: "project", id: b };
      if (b && c === "settings" && parts.length === 3) return { kind: "project-settings", id: b };
      return null;
    case "library": return parts.length === 1 ? { kind: "library" } : null;
    case "books": return b && parts.length === 2 ? { kind: "book", id: b } : null;
    case "wishlists":
      if (parts.length === 1) return { kind: "wishlists" };
      if (b && parts.length === 2) return { kind: "wishlist", id: b };
      return null;
    case "wishlist-items": return b && parts.length === 2 ? { kind: "wishlist-item", id: b } : null;
    case "lists": return parts.length === 1 ? { kind: "lists" } : null;
    case "settings": return parts.length === 1 ? { kind: "settings" } : null;
    default: return null;
  }
}

export function routeToLink(route: Route): string {
  return `${window.location.origin}${window.location.pathname}${routeToHash(route)}`;
}

/** True when href points at this app and parses to a known Route — used to
 *  render in-tab (hash-navigating) anchors instead of new-tab links. */
export function isInternalLink(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && parseHash(url.hash) !== null;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm lint`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/appRoute.ts
git commit -m "feat(links): add hash-based route module"
```

---

### Task 2: `useTask(id)` hook

**Files:**
- Modify: `frontend/src/hooks/useTasks.ts` (add after `useTasks`, near line 16)

**Interfaces:**
- Consumes: `api`, `Task` (already imported in the file).
- Produces: `useTask(id: string | null)` → `UseQueryResult<Task>`, fetching `GET /tasks/{id}`, disabled when `id` is falsy.

- [ ] **Step 1: Add the hook**

In `frontend/src/hooks/useTasks.ts`, insert immediately after the `useTasks` function (after the line containing `return useQuery({ queryKey: tasksKey(filter), queryFn: () => api.get<Task[]>(\`/tasks${qs(filter)}\`) });` and its closing `}`):

```ts
export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api.get<Task>(`/tasks/${id}`),
    enabled: !!id,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useTasks.ts
git commit -m "feat(links): add useTask(id) hook for deep-link resolution"
```

---

### Task 3: `CopyLinkButton` component

**Files:**
- Create: `frontend/src/components/ui/CopyLinkButton.tsx`

**Interfaces:**
- Consumes: `routeToLink`, `Route` from `@/lib/appRoute`; `cn` from `@/lib/utils`.
- Produces: `CopyLinkButton({ route?, className?, label? })`. With `route`, copies `routeToLink(route)`; without, copies `window.location.href`. Shows a transient check on success.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ui/CopyLinkButton.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { routeToLink, type Route } from "@/lib/appRoute";

export function CopyLinkButton({
  route,
  className,
  label = "Copy link",
}: {
  route?: Route;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    const link = route ? routeToLink(route) : window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={copied ? "Copied" : label}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-bg",
        className,
      )}
    >
      {copied ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/CopyLinkButton.tsx
git commit -m "feat(links): add CopyLinkButton component"
```

---

### Task 4: Internal links in markdown

**Files:**
- Modify: `frontend/src/components/ui/markdown.tsx`

**Interfaces:**
- Consumes: `isInternalLink` from `@/lib/appRoute`.

- [ ] **Step 1: Update the link renderer**

Replace the entire contents of `frontend/src/components/ui/markdown.tsx` with:

```tsx
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { isInternalLink } from "@/lib/appRoute";

// Central, app-wide markdown renderer. GitHub-Flavored Markdown (tables, task
// lists, strikethrough, autolinks) via remark-gfm. Raw HTML is intentionally
// NOT enabled, so user content cannot inject markup — react-markdown escapes it.
const COMPONENTS: Components = {
  a: ({ node: _node, href, ...props }) => {
    // Internal app links navigate in-place via a hash change (no new tab).
    if (href && isInternalLink(href)) {
      return <a href={href} {...props} />;
    }
    // External links always open in a new tab and never leak referrer/opener.
    return <a href={href} {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown-body prose prose-sm max-w-none break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `pnpm lint && pnpm build`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/markdown.tsx
git commit -m "feat(links): render internal markdown links as in-tab anchors"
```

---

### Task 5: App hash ↔ state sync + deep-link resolution

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/wishlist/WishlistView.tsx` (add `initialItemId` prop)

**Interfaces:**
- Consumes: `parseHash`, `routeToHash`, `type Route` from `@/lib/appRoute`; `useTask` from `@/hooks/useTasks`; `useWishlistItem` from `@/hooks/useWishlists`.
- Produces: `WishlistView` accepts an optional `initialItemId?: string | null` and opens its drawer for that item once loaded.

- [ ] **Step 1: Add `initialItemId` to WishlistView**

In `frontend/src/components/wishlist/WishlistView.tsx`:

(a) Add `useEffect` to the React import. Change line 1 `import { useState } from "react";` to:

```tsx
import { useEffect, useState } from "react";
```

(b) Change the component signature (around line 118):

```tsx
export function WishlistView({
  id,
  onBack,
  initialItemId,
}: {
  id: string;
  onBack: () => void;
  initialItemId?: string | null;
}) {
```

(c) Immediately after the existing state declarations (after line 126 `const [drawerOpen, setDrawerOpen] = useState(false);`), add:

```tsx
  const { data: wishlistForInitial } = useWishlist(id);
  useEffect(() => {
    if (!initialItemId || !wishlistForInitial) return;
    const match = wishlistForInitial.items.find((i) => i.id === initialItemId);
    if (match) {
      setSelectedItem(match);
      setDrawerOpen(true);
    }
  }, [initialItemId, wishlistForInitial]);
```

(`useWishlist` is already imported in this file and is cache-backed, so calling it twice is cheap.)

- [ ] **Step 2: Wire route sync into App.tsx**

In `frontend/src/App.tsx`:

(a) Add imports near the other imports (after the `useTasks` import line):

```tsx
import { useTask } from "@/hooks/useTasks";
import { useWishlistItem } from "@/hooks/useWishlists";
import { parseHash, routeToHash, type Route } from "@/lib/appRoute";
```

(b) Add new state alongside the existing `useState` declarations (after `const [openTask, setOpenTask] = useState<Task | null>(null);`):

```tsx
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
```

(c) Add the route-application logic and effects. Insert this block right AFTER the existing GitHub-OAuth `useEffect` (the one that ends with `}, []);` after `history.replaceState(null, "", location.pathname);`):

```tsx
  // --- Deep linking: hash <-> view state -------------------------------------

  // Apply a parsed route to the view state. Task / wishlist-item routes only
  // record a "pending" id here; the data is fetched below, then the panel opens.
  function applyRoute(route: Route | null) {
    const r: Route = route ?? { kind: "tasks" };
    switch (r.kind) {
      case "tasks": setOpenTask(null); setProjectId(null); setPage("tasks"); break;
      case "project": setOpenTask(null); setProjectId(r.id); setPage("tasks"); break;
      case "project-settings": setProjectId(r.id); setPage("project-settings"); break;
      case "task": setPendingTaskId(r.id); break;
      case "library": setLibraryBookId(null); setPage("library"); break;
      case "book": setLibraryBookId(r.id); setPage("library"); break;
      case "wishlists": setPage("wishlists"); break;
      case "wishlist": setWishlistId(r.id); setWishlistItemId(null); setPage("wishlist"); break;
      case "wishlist-item": setPendingItemId(r.id); break;
      case "lists": setPage("lists"); break;
      case "settings": setPage("settings"); break;
    }
  }

  // On mount + back/forward: parse the hash and apply it. replaceState (used for
  // writing below) does not emit hashchange, so this only fires on real
  // navigations and user link clicks.
  useEffect(() => {
    const apply = () => applyRoute(parseHash(window.location.hash));
    apply();
    setHydrated(true);
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve a pending task deep-link: fetch it, open its board + detail panel.
  const { data: resolvedTask } = useTask(pendingTaskId);
  useEffect(() => {
    if (!resolvedTask) return;
    setProjectId(resolvedTask.projectId ?? null);
    setPage("tasks");
    setOpenTask(resolvedTask);
    setPendingTaskId(null);
  }, [resolvedTask]);

  // Resolve a pending wishlist-item deep-link: fetch it, open its wishlist + drawer.
  const { data: resolvedItem } = useWishlistItem(pendingItemId ?? "");
  useEffect(() => {
    if (!resolvedItem) return;
    setWishlistId(resolvedItem.wishlistId);
    setWishlistItemId(resolvedItem.id);
    setPage("wishlist");
    setPendingItemId(null);
  }, [resolvedItem]);

  // Derive the current route from view state (openTask wins when a task is open).
  const currentRoute: Route =
    openTask ? { kind: "task", id: openTask.id }
    : page === "project-settings" && projectId ? { kind: "project-settings", id: projectId }
    : page === "tasks" ? (projectId ? { kind: "project", id: projectId } : { kind: "tasks" })
    : page === "library" ? (libraryBookId ? { kind: "book", id: libraryBookId } : { kind: "library" })
    : page === "wishlists" ? { kind: "wishlists" }
    : page === "wishlist" && wishlistId ? { kind: "wishlist", id: wishlistId }
    : page === "lists" ? { kind: "lists" }
    : page === "settings" ? { kind: "settings" }
    : { kind: "tasks" };
  const currentHash = routeToHash(currentRoute);

  // Reflect the view into the address bar. Hold off until the initial hash has
  // been applied and while a deep-link fetch is still pending, so we never
  // clobber an incoming link before it resolves.
  useEffect(() => {
    if (!hydrated || pendingTaskId || pendingItemId) return;
    if (window.location.hash !== currentHash) {
      window.history.replaceState(null, "", currentHash);
    }
  }, [hydrated, currentHash, pendingTaskId, pendingItemId]);
```

(d) Pass `initialItemId` to `WishlistView`. Change the render line:

```tsx
          ) : page === "wishlist" && wishlistId ? (
            <WishlistView id={wishlistId} onBack={() => setPage("wishlists")} />
```

to:

```tsx
          ) : page === "wishlist" && wishlistId ? (
            <WishlistView id={wishlistId} initialItemId={wishlistItemId} onBack={() => setPage("wishlists")} />
```

- [ ] **Step 3: Type-check and build**

Run: `pnpm lint && pnpm build`
Expected: both PASS. (If `tsc` flags `Route` as unused in WishlistView, ignore — it is used in App.)

- [ ] **Step 4: Manual smoke — sync**

Start `pnpm dev`. Log in. Click around (a project, Wishlists, a wishlist, Lists, Settings, open a task) and confirm the address bar hash updates to match (`#/projects/…`, `#/wishlists/…`, `#/lists`, `#/task/…`). Reload on a `#/task/<id>` URL → the board opens with that task's detail panel. Reload on `#/wishlist-items/<id>` → the wishlist opens with that item's drawer. Browser back/forward moves between views.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/wishlist/WishlistView.tsx
git commit -m "feat(links): sync hash with view state and resolve deep links"
```

---

### Task 6: Place CopyLinkButton on every surface

**Files:**
- Modify: `frontend/src/components/layout/Topbar.tsx`
- Modify: `frontend/src/components/task/TaskDetailPanel.tsx`
- Modify: `frontend/src/components/wishlist/WishlistItemDrawer.tsx`
- Modify: `frontend/src/components/wishlist/WishlistsPage.tsx`
- Modify: `frontend/src/components/wishlist/WishlistView.tsx`
- Modify: `frontend/src/components/todo/ListsPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/LibraryPage.tsx`
- Modify: `frontend/src/pages/ProjectSettingsPage.tsx`

**Interfaces:**
- Consumes: `CopyLinkButton` from `@/components/ui/CopyLinkButton`; `Route` from `@/lib/appRoute` (only where an explicit route is passed).

- [ ] **Step 1: Topbar (tasks / project board)**

In `frontend/src/components/layout/Topbar.tsx`, add the import after the existing imports:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Then add the button just before the Search button. Change:

```tsx
        <Button variant="ghost" size="icon" onClick={onOpenPalette} aria-label="Search (Cmd+K)" className="shrink-0">
          <Search className="size-4" />
        </Button>
```

to:

```tsx
        <CopyLinkButton className="shrink-0 size-9" />
        <Button variant="ghost" size="icon" onClick={onOpenPalette} aria-label="Search (Cmd+K)" className="shrink-0">
          <Search className="size-4" />
        </Button>
```

- [ ] **Step 2: TaskDetailPanel (task link)**

In `frontend/src/components/task/TaskDetailPanel.tsx`, add the imports:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Replace the `SheetHeader` block:

```tsx
        <SheetHeader className="p-0">
          <SheetTitle className="font-mono text-xs text-ink-muted text-left">{task.identifier}</SheetTitle>
        </SheetHeader>
```

with:

```tsx
        <SheetHeader className="p-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-mono text-xs text-ink-muted text-left">{task.identifier}</SheetTitle>
            <CopyLinkButton route={{ kind: "task", id: task.id }} />
          </div>
        </SheetHeader>
```

- [ ] **Step 3: WishlistItemDrawer (wishlist-item link, only when editing)**

In `frontend/src/components/wishlist/WishlistItemDrawer.tsx`, add the import:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Replace the `SheetHeader`:

```tsx
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Item" : "New Item"}</SheetTitle>
        </SheetHeader>
```

with:

```tsx
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{isEditing ? "Edit Item" : "New Item"}</SheetTitle>
            {isEditing && item && <CopyLinkButton route={{ kind: "wishlist-item", id: item.id }} />}
          </div>
        </SheetHeader>
```

- [ ] **Step 4: WishlistsPage header**

In `frontend/src/components/wishlist/WishlistsPage.tsx`, add the import:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Change the header row:

```tsx
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Wishlists</h1>
        <Button onClick={() => setListDialog({ open: true, editing: null })}>
          <Plus className="size-4 mr-1" /> New Wishlist
        </Button>
      </div>
```

to:

```tsx
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          <h1 className="font-display text-2xl font-bold">Wishlists</h1>
          <CopyLinkButton />
        </div>
        <Button onClick={() => setListDialog({ open: true, editing: null })}>
          <Plus className="size-4 mr-1" /> New Wishlist
        </Button>
      </div>
```

- [ ] **Step 5: WishlistView header**

In `frontend/src/components/wishlist/WishlistView.tsx`, add the import:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Find the header title (around line 158) `<h1 className="font-display text-2xl font-bold">{wishlist.name}</h1>` and add the button right after it:

```tsx
          <h1 className="font-display text-2xl font-bold">{wishlist.name}</h1>
          <CopyLinkButton route={{ kind: "wishlist", id: wishlist.id }} />
```

- [ ] **Step 6: ListsPage header**

Replace `frontend/src/components/todo/ListsPage.tsx` with:

```tsx
import { TodosBoard } from "@/components/todo/TodosBoard";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

export function ListsPage() {
  return (
    <div className="p-2">
      <div className="flex items-center gap-1 mb-6">
        <h1 className="font-display text-2xl font-bold">Lists</h1>
        <CopyLinkButton />
      </div>
      <TodosBoard />
    </div>
  );
}
```

- [ ] **Step 7: SettingsPage header**

Replace `frontend/src/pages/SettingsPage.tsx` with:

```tsx
import { AccountSettings } from "@/components/account/AccountSettings";
import { LabelsSettings } from "@/components/settings/LabelsSettings";
import { GithubSettings } from "@/components/settings/GithubSettings";
import { TrashSettings } from "@/components/settings/TrashSettings";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

export function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-8">
      <div className="flex items-center gap-1">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <CopyLinkButton />
      </div>
      <AccountSettings />
      <LabelsSettings />
      <GithubSettings />
      <TrashSettings />
    </div>
  );
}
```

- [ ] **Step 8: LibraryPage (book header — explicit book route)**

In `frontend/src/pages/LibraryPage.tsx`, add the import after the existing imports:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Change the book header block:

```tsx
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold">{book.name}</span>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => deleteBook.mutate(book.id, { onSuccess: () => setNav(backFromBook()) })}>
              <Trash2 className="size-4" /> Delete book
            </Button>
          </div>
```

to:

```tsx
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="font-display text-lg font-bold">{book.name}</span>
              <CopyLinkButton route={{ kind: "book", id: book.id }} />
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => deleteBook.mutate(book.id, { onSuccess: () => setNav(backFromBook()) })}>
              <Trash2 className="size-4" /> Delete book
            </Button>
          </div>
```

Also add a shelf-level copy button. Change the "Back to board" button block:

```tsx
      <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to board
      </button>
```

to:

```tsx
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to board
        </button>
        {nav.level === "shelf" && <CopyLinkButton />}
      </div>
```

- [ ] **Step 9: ProjectSettingsPage header**

In `frontend/src/pages/ProjectSettingsPage.tsx`, add the import after the existing imports:

```tsx
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
```

Change the main "Back to board" button (around line 77):

```tsx
      <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to board
      </button>
```

to:

```tsx
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to board
        </button>
        <CopyLinkButton route={{ kind: "project-settings", id: projectId }} />
      </div>
```

- [ ] **Step 10: Type-check and build**

Run: `pnpm lint && pnpm build`
Expected: both PASS.

- [ ] **Step 11: Manual smoke — full feature**

With `pnpm dev`:
1. On each surface (All tasks, a project board, project settings, a task panel, Library shelf, a book, Wishlists, a wishlist, a wishlist item drawer, Lists, Settings) click the copy-link button and confirm the clipboard holds the matching `#/…` URL.
2. Paste a task link and a wishlist link into another task's description; switch to Preview — both render as links. Click the task link → its board + detail panel open with **no page reload**. Click an external `https://` link in the same description → opens in a new tab.
3. Open each copied link in a fresh browser tab → app loads directly on the destination (panels/drawers open for task & wishlist-item).
4. Browser back/forward navigates between visited views.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/layout/Topbar.tsx frontend/src/components/task/TaskDetailPanel.tsx frontend/src/components/wishlist/WishlistItemDrawer.tsx frontend/src/components/wishlist/WishlistsPage.tsx frontend/src/components/wishlist/WishlistView.tsx frontend/src/components/todo/ListsPage.tsx frontend/src/pages/SettingsPage.tsx frontend/src/pages/LibraryPage.tsx frontend/src/pages/ProjectSettingsPage.tsx
git commit -m "feat(links): add copy-link buttons across all surfaces"
```

---

## Self-Review

**Spec coverage:**
- Hash URL scheme (all 11 destinations) → Task 1 (`routeToHash`/`parseHash`). ✓
- Routing module (`parseHash`/`routeToHash`/`routeToLink`/`isInternalLink`) → Task 1. ✓
- App hash↔state sync, deep-link resolution (task/book/wishlist-item), `replaceState` reflection → Task 5 (+ `useTask` in Task 2). ✓
- Internal markdown links in-tab, external `_blank` → Task 4. ✓
- CopyLinkButton + placements (Topbar, all page headers, TaskDetailPanel, WishlistItemDrawer) → Task 3 + Task 6. ✓
- Testing approach (lint/build + manual checklist; no runner) → Global Constraints + Task 6 smoke. ✓
- Out-of-scope (path URLs, book-page deep links, toasts) → not implemented. ✓

**Placeholder scan:** No TBD/vague steps — every code step shows full code; commands have expected results. The one allowed-ambiguity note (tsc unused `Route`) tells the executor exactly what to do.

**Type consistency:** `Route` variant names and id fields are identical across Tasks 1, 5, 6 (`{kind:"task", id}`, `{kind:"wishlist-item", id}`, `{kind:"book", id}`, `{kind:"project-settings", id}`). `useTask(id)` (Task 2) is consumed in Task 5 with the same signature. `CopyLinkButton`'s optional `route` prop (Task 3) is used both with and without a route in Task 6. `initialItemId` prop added to WishlistView in Task 5 matches the App call site and the Task 6 import addition to the same file (both edits coexist).
