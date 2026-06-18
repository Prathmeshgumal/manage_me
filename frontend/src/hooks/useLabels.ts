import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Label, CreateLabelInput } from "@/types";
import { api } from "@/lib/api";

export function useLabels() {
  return useQuery({ queryKey: ["labels"], queryFn: () => api.get<Label[]>("/labels") });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: CreateLabelInput) => api.post<Label>("/labels", i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labels"] }),
  });
}
