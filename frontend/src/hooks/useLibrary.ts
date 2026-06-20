import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shelf, Book, BookSummary, Page, PageSummary, CreateBookInput, UpdateBookInput, UpdateShelfInput, CreatePageInput, UpdatePageInput, OrphanShelf } from "@/types";
import { api } from "@/lib/api";

export function useShelf(projectId: string | null) {
  return useQuery({
    queryKey: ["library", "shelf", projectId],
    queryFn: () => api.get<Shelf>(projectId ? `/projects/${projectId}/shelf` : `/shelf`),
  });
}

export function useOrphanShelves(enabled = true) {
  return useQuery({
    queryKey: ["library", "orphaned"],
    queryFn: () => api.get<OrphanShelf[]>("/shelves/orphaned"),
    enabled,
  });
}

export function useShelfById(shelfId: string | null) {
  return useQuery({
    queryKey: ["library", "shelf-by-id", shelfId],
    queryFn: () => api.get<Shelf>(`/shelves/${shelfId}`),
    enabled: !!shelfId,
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
  const key = ["library", "shelf", projectId];
  return useMutation({
    mutationFn: ({ shelfId, input }: { shelfId: string; input: CreateBookInput }) => api.post<Book>(`/shelves/${shelfId}/books`, input),
    // Optimistically show the new book immediately; reconcile with the server
    // response instead of refetching the whole shelf (avoids a second slow round-trip).
    onMutate: async ({ input }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Shelf>(key);
      const tempId = `temp-${crypto.randomUUID()}`;
      if (previous) {
        const optimistic: BookSummary = {
          id: tempId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? "#888888",
          sortOrder: previous.books.length,
          pageCount: 0,
        };
        qc.setQueryData<Shelf>(key, { ...previous, books: [...previous.books, optimistic] });
      }
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<Shelf>(key, (cur) => {
        if (!cur) return cur;
        const summary: BookSummary = {
          id: created.id,
          name: created.name,
          description: created.description,
          color: created.color,
          sortOrder: created.sortOrder,
          pageCount: created.pages.length,
        };
        return { ...cur, books: cur.books.map((b) => (b.id === ctx?.tempId ? summary : b)) };
      });
    },
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

export function useDeleteBook(_projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/books/${id}`),
    // Broad invalidation so project shelf, General shelf and orphan-shelf views all refresh.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useCreatePage(bookId: string | null) {
  const qc = useQueryClient();
  const key = ["library", "book", bookId];
  return useMutation({
    mutationFn: (input: CreatePageInput) => api.post<Page>(`/books/${bookId}/pages`, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Book>(key);
      const tempId = `temp-${crypto.randomUUID()}`;
      if (previous) {
        const optimistic: PageSummary = {
          id: tempId,
          title: input.title,
          sortOrder: previous.pages.length,
          updatedAt: new Date().toISOString(),
        };
        qc.setQueryData<Book>(key, { ...previous, pages: [...previous.pages, optimistic] });
      }
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<Book>(key, (cur) => {
        if (!cur) return cur;
        const summary: PageSummary = {
          id: created.id,
          title: created.title,
          sortOrder: created.sortOrder,
          updatedAt: created.updatedAt,
        };
        return { ...cur, pages: cur.pages.map((p) => (p.id === ctx?.tempId ? summary : p)) };
      });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library", "book", bookId] });
      qc.invalidateQueries({ queryKey: ["library", "shelf-by-id"] });
    },
  });
}
