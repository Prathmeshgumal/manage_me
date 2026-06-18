// API contract types for the MySchedule backend.
// Kept in sync with backend/src/schemas.ts (this app is deployed independently).

export type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
export type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface LabelRef {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
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
  id: string; projectId: string; name: string; description: string | null; books: BookSummary[];
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
