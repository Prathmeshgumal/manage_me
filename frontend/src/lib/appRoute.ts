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
