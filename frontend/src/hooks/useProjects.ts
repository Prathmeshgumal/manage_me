import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, CreateProjectInput, UpdateProjectInput } from "@/types";
import { api } from "@/lib/api";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => api.get<Project[]>("/projects") });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: CreateProjectInput) => api.post<Project>("/projects", i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProjectInput }) => api.patch<Project>(`/projects/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] }); // a key change rewrites task identifiers
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] }); // tasks reference projects
    },
  });
}
