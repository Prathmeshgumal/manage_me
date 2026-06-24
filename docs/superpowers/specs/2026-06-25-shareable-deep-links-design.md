# Shareable deep links

**Date:** 2026-06-25
**Status:** Approved

## Overview

Add a copy-link button to every page (and to individual tasks, books, and
wishlist items) that yields a shareable URL. Pasting such a link into a task
description (or anywhere markdown is rendered) produces a clickable link that
navigates to the destination **in-place, without a page reload**.

The app currently navigates by pure React state (no router, no URLs for views).
This feature introduces a hash-based URL scheme, a small routing module, and
state↔hash synchronization. It is **frontend-only** — every resource needed for
deep-link resolution already has a single-resource GET endpoint
(`GET /tasks/{id}`, `GET /books/{id}`, `GET /items/{id}`).

## URL scheme (hash-based)

Hash URLs (`https://app/#/…`) are used rather than path URLs: hash changes never
hit the server, behave identically in dev and prod, and do not interfere with
the existing GitHub-OAuth flow (which reads `location.search` / `location.pathname`).

| Destination       | Hash                          |
| ----------------- | ----------------------------- |
| All tasks         | `#/tasks`                     |
| Project board     | `#/projects/<id>`             |
| Project settings  | `#/projects/<id>/settings`    |
| A task            | `#/task/<id>`                 |
| Library / shelf   | `#/library`                   |
| A book            | `#/books/<id>`                |
| A book page       | `#/pages/<id>`                |
| Wishlists         | `#/wishlists`                 |
| A wishlist        | `#/wishlists/<id>`            |
| A wishlist item   | `#/wishlist-items/<id>`       |
| Lists (todo)      | `#/lists`                     |
| Settings          | `#/settings`                  |

An empty/unrecognized hash resolves to `#/tasks` (the default view).

## Routing module (`frontend/src/lib/appRoute.ts`)

A pure, isolated unit holding all URL knowledge:

```ts
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

export function routeToHash(route: Route): string;        // -> "#/projects/abc"
export function parseHash(hash: string): Route | null;    // "#/projects/abc" -> Route
export function routeToLink(route: Route): string;         // absolute URL incl. origin+pathname+hash
export function isInternalLink(href: string): boolean;     // same-origin && hash parses to a Route
```

`routeToLink` builds `window.location.origin + window.location.pathname +
routeToHash(route)`. `isInternalLink` parses `href` via `new URL`, checks
`origin === location.origin`, and that `parseHash(url.hash)` is non-null.

## App integration (state ↔ hash) — `frontend/src/App.tsx`

State stays as-is (`page`, `projectId`, `wishlistId`, `libraryBookId`,
`openTask`, plus a new `openWishlistItemId` if needed for the drawer). Two
directions of sync:

- **Hash → state (deep-link resolution).** On mount and on every `hashchange`,
  parse the hash and apply it:
  - `tasks` → `page="tasks"`, `projectId=null`
  - `project` → `page="tasks"`, `projectId=id`
  - `project-settings` → `page="project-settings"`, `projectId=id`
  - `library` → `page="library"`
  - `book` → `page="library"`, `libraryBookId=id`
  - `wishlists` → `page="wishlists"`
  - `wishlist` → `page="wishlist"`, `wishlistId=id`
  - `lists` → `page="lists"`
  - `settings` → `page="settings"`
  - `task` → set the board page (fetch the task by id to learn its `projectId`,
    set `projectId`, `page="tasks"`), then open `TaskDetailPanel` with the fetched task.
  - `wishlist-item` → fetch the item by id to learn its `wishlistId`, open the
    wishlist (`page="wishlist"`, `wishlistId`), then open `WishlistItemDrawer`.

- **State → hash (address-bar reflection).** A single effect computes
  `currentRoute(state)` and writes it with `history.replaceState(null, "",
  routeToHash(route))` whenever the view changes, so the address bar always
  matches the current view and the copy button can read the live URL.

A re-entrancy guard prevents the two effects from looping (e.g. ignore the next
`hashchange` that our own `replaceState` triggers — `replaceState` does not emit
`hashchange`, so in practice only programmatic `location.hash` writes would;
since we use `replaceState`, no extra guard is required, but the apply function
is written to be idempotent).

The existing OAuth effect (reads `location.search`, resets to
`location.pathname`) is preserved and runs before route application; it does not
touch the hash.

### Deep-link data fetching

A new `useTask(id)` hook (mirroring `useBook`) fetches `GET /tasks/{id}`.
`useBook` and `useWishlistItem` already exist. Resolution components/effects use
these; while a fetch is in flight the underlying page renders normally and the
panel/drawer opens once data arrives.

## Internal links in markdown — `frontend/src/components/ui/markdown.tsx`

The `<a>` renderer currently forces `target="_blank"`. New behavior:

- If `isInternalLink(href)` → render a normal in-tab anchor (no `target`,
  no `rel`). Clicking only changes the hash → `hashchange` fires → route applied
  → in-place navigation, no reload.
- Otherwise → keep `target="_blank" rel="noopener noreferrer"`.

## Copy-link button — `frontend/src/components/ui/CopyLinkButton.tsx`

`<CopyLinkButton route={Route} className?, label? />`:

- Renders a `Link` (lucide) icon button.
- On click: `navigator.clipboard.writeText(routeToLink(route))`, then swaps to a
  `Check` icon with a "Copied" title for ~1.5s (local `useState` + `setTimeout`,
  cleared on unmount). No global toast dependency.

Placements (each passes the Route for its view):

- `Topbar` — All tasks / project board (`{kind:"tasks"}` or `{kind:"project"}`).
- Page headers: project-settings, library, book (LibraryPage), wishlists, a
  wishlist (WishlistView), lists (ListsPage), settings.
- `TaskDetailPanel` header → `{kind:"task", id}`.
- `WishlistItemDrawer` header → `{kind:"wishlist-item", id}`.

## Testing

- Core logic lives in pure functions (`parseHash`/`routeToHash` round-trips,
  `isInternalLink`). The repo has no frontend test runner, so correctness is
  verified by `pnpm lint` + `pnpm build` and a manual smoke checklist:
  1. From each surface, click copy-link and confirm the clipboard URL matches
     the table above.
  2. Paste a task link into another task's description; in Preview, the link is
     clickable and lands on the right view **without a reload**.
  3. Open each link in a fresh browser tab → app loads directly on the
     destination (task/book/wishlist-item open their panel/drawer).
  4. Browser back/forward moves between visited views.
  5. External links in markdown still open in a new tab.

## Out of scope (YAGNI)

- Path-based (non-hash) URLs.
- Link previews/unfurling, access control on shared links beyond existing auth,
  and a global toast system.

## Library navigation note

The library has internal navigation (shelf → book → page) that LibraryPage owns.
To keep the URL accurate there, LibraryPage accepts a `target` Route (the
destination to navigate to, set on rail clicks and deep links) and reports its
current location back via `onRoute`, which App reflects into the hash. Book-page
deep links (`#/pages/<id>`) resolve the page by id (`GET /pages/{id}`) to learn
its book, then open it.
