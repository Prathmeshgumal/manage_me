import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, UpdateTaskInput, CreateTaskInput, TaskFilter } from "@myschedule/shared";
import { api } from "@/lib/api";

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
        qc.setQueryData<Task[]>(key, list.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t)));
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
