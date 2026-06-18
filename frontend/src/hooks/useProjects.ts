import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, CreateProjectInput } from "@/types";
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
