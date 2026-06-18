import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shelf, Book, Page, CreateBookInput, UpdateBookInput, UpdateShelfInput, CreatePageInput, UpdatePageInput } from "@/types";
import { api } from "@/lib/api";

export function useShelf(projectId: string | null) {
  return useQuery({
    queryKey: ["library", "shelf", projectId],
    queryFn: () => api.get<Shelf>(projectId ? `/projects/${projectId}/shelf` : `/shelf`),
  });
}

export function useUpdateShelf(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateShelfInput }) => api.patch<Shelf>(`/shelves/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] }),
  });
}

export function useCreateBook(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, input }: { shelfId: string; input: CreateBookInput }) => api.post<Book>(`/shelves/${shelfId}/books`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] }),
  });
}

export function useBook(bookId: string | null) {
  return useQuery({
    queryKey: ["library", "book", bookId],
    queryFn: () => api.get<Book>(`/books/${bookId}`),
    enabled: !!bookId,
  });
}

export function useUpdateBook(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBookInput }) => api.patch<Book>(`/books/${id}`, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["library", "book", v.id] });
      qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] });
    },
  });
}

export function useDeleteBook(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/books/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] }),
  });
}

export function useCreatePage(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePageInput) => api.post<Page>(`/books/${bookId}/pages`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "book", bookId] }),
  });
}

export function usePage(pageId: string | null) {
  return useQuery({
    queryKey: ["library", "page", pageId],
    queryFn: () => api.get<Page>(`/pages/${pageId}`),
    enabled: !!pageId,
  });
}

export function useUpdatePage(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePageInput }) => api.patch<Page>(`/pages/${id}`, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["library", "page", v.id] });
      qc.invalidateQueries({ queryKey: ["library", "book", bookId] });
    },
  });
}

export function useDeletePage(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "book", bookId] }),
  });
}
