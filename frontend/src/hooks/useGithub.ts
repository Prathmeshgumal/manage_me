import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GithubRepo, RepoContents } from "@/types";
import { api } from "@/lib/api";

export const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type GithubStatus = {
  user: { login: string; avatarUrl: string } | null;
  installations: Array<{ installationId: number; accountLogin: string; accountType: string; repositorySelection: string }>;
};

export type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type ContributionCalendar = { totalContributions: number; weeks: { days: ContributionDay[] }[] };

export function useGithubStatus() {
  return useQuery({ queryKey: ["github", "status"], queryFn: () => api.get<GithubStatus>("/github/status") });
}

export function useContributions(enabled: boolean) {
  return useQuery({
    queryKey: ["github", "contributions"],
    queryFn: () => api.get<ContributionCalendar>("/github/contributions"),
    enabled,
    retry: false,
  });
}

export function useRepositories(enabled: boolean) {
  return useQuery({
    queryKey: ["github", "repositories"],
    queryFn: () => api.get<GithubRepo[]>("/github/repositories"),
    enabled,
    retry: false,
  });
}

export function useRepoContents(params: { installationId: number; owner: string; repo: string; path: string } | null) {
  return useQuery({
    queryKey: ["github", "contents", params],
    queryFn: () => {
      const p = params!;
      const qs = new URLSearchParams({
        installationId: String(p.installationId), owner: p.owner, repo: p.repo, path: p.path,
      }).toString();
      return api.get<RepoContents>(`/github/repos/contents?${qs}`);
    },
    enabled: !!params,
    retry: false,
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/github/disconnect", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["github"] }),
  });
}
