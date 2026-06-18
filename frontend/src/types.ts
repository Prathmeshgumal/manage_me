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
}

export interface CreateLabelInput {
  name: string;
  color?: string;
}
