// API contract types for the MySchedule backend.
// Kept in sync with backend-py/app/schemas.py (this app is deployed independently).

export type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
export type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface LabelRef {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  identifier: string;
  number: number | null;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  projectId: string | null;
  sortOrder: number;
  labels: LabelRef[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  color: string;
  githubRepoId: number | null;
  githubRepoFullName: string | null;
  githubInstallationId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface TaskFilter {
  status?: Status;
  priority?: Priority;
  projectId?: string;
  labelId?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: Status;
  priority?: Priority;
  dueDate?: Date | string | null;
  projectId?: string | null;
  labelIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: Status;
  priority?: Priority;
  dueDate?: Date | string | null;
  projectId?: string | null;
  sortOrder?: number;
  labelIds?: string[];
}

export interface CreateProjectInput {
  name: string;
  key?: string;
  color?: string;
  githubRepoId?: number | null;
  githubRepoFullName?: string | null;
  githubInstallationId?: number | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface GithubRepo {
  id: number;
  fullName: string;
  private: boolean;
  installationId: number;
}

export type RepoDirEntry = { name: string; path: string; type: "dir" | "file" };
export type RepoContents =
  | { type: "dir"; entries: RepoDirEntry[] }
  | { type: "file"; name: string; path: string; size: number; content: string; isBinary: boolean; tooLarge: boolean };

export interface CreateLabelInput {
  name: string;
  color?: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
}

export interface BookSummary {
  id: string; name: string; description: string | null; color: string; sortOrder: number; pageCount: number;
}
export interface Shelf {
  id: string; projectId: string | null; name: string; description: string | null; books: BookSummary[];
}
export interface PageSummary { id: string; title: string; sortOrder: number; updatedAt: string; }
export interface Book {
  id: string; name: string; description: string | null; color: string; sortOrder: number; pages: PageSummary[];
}
export interface Page {
  id: string; bookId: string; title: string; content: string; sortOrder: number; createdAt: string; updatedAt: string;
}
export interface CreateBookInput { name: string; description?: string | null; color?: string; }
export interface UpdateBookInput { name?: string; description?: string | null; color?: string; }
export interface UpdateShelfInput { name?: string; description?: string | null; }
export interface CreatePageInput { title: string; }
export interface UpdatePageInput { title?: string; content?: string; }

export type AuthUser = { id: string; email: string };

export type TrashKind = "project" | "task" | "book" | "page";
export interface TrashBundle {
  projects: { id: string; name: string; deletedAt: string }[];
  tasks: { id: string; title: string; deletedAt: string }[];
  books: { id: string; name: string; deletedAt: string }[];
  pages: { id: string; title: string; deletedAt: string }[];
}
export interface OrphanShelf { id: string; name: string; bookCount: number; }

export type WishlistCategory = "Items" | "Places" | "Goals" | "Other";
export type WishlistItemStatus = "WISHLIST" | "SAVING" | "PURCHASED" | "ARCHIVED";
export type WishlistItemPriority = "MUST_HAVE" | "NICE_TO_HAVE" | "DREAM";

export interface Wishlist {
  id: string;
  name: string;
  description: string | null;
  category: WishlistCategory;
  icon: string | null;
  color: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistDetail extends Wishlist {
  items: WishlistItem[];
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  status: WishlistItemStatus;
  priority: WishlistItemPriority;
  targetDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWishlistInput {
  name: string;
  description?: string | null;
  category?: WishlistCategory;
  icon?: string | null;
  color?: string;
}

export interface UpdateWishlistInput {
  name?: string;
  description?: string | null;
  category?: WishlistCategory;
  icon?: string | null;
  color?: string;
}

export interface CreateWishlistItemInput {
  title: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  status?: WishlistItemStatus;
  priority?: WishlistItemPriority;
  targetDate?: string | null;
}

export interface UpdateWishlistItemInput {
  title?: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  status?: WishlistItemStatus;
  priority?: WishlistItemPriority;
  targetDate?: string | null;
  sortOrder?: number;
}
