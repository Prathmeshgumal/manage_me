import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TodoListDetail,
  TodoItem,
  CreateTodoListInput,
  UpdateTodoListInput,
  CreateTodoItemInput,
  UpdateTodoItemInput,
} from "@/types";
import { api } from "@/lib/api";

export const todoListsKey = () => ["todoLists"] as const;

export function useTodoLists() {
  return useQuery({
    queryKey: todoListsKey(),
    queryFn: () => api.get<TodoListDetail[]>("/lists"),
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoListInput) => api.post<TodoListDetail>("/lists", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTodoListInput }) =>
      api.patch<TodoListDetail>(`/lists/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/lists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: CreateTodoItemInput }) =>
      api.post<TodoItem>(`/lists/${listId}/todos`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTodoItemInput }) =>
      api.patch<TodoItem>(`/todos/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.del(`/todos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}
