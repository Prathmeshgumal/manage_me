import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TrashBundle, TrashKind } from "@/types";

export function useTrash() {
  return useQuery({ queryKey: ["trash"], queryFn: () => api.get<TrashBundle>("/trash") });
}

function invalidateEverything(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["trash"] });
  qc.invalidateQueries({ queryKey: ["projects"] });
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["library"] });
}

export function useRestoreTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: string }) => api.post(`/trash/${kind}/${id}/restore`, {}),
    onSuccess: () => invalidateEverything(qc),
  });
}

export function usePurgeTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: string }) => api.del(`/trash/${kind}/${id}`),
    onSuccess: () => invalidateEverything(qc),
  });
}
