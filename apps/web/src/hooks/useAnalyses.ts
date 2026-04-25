import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import type { AnalysesResponse, AnalysisDetail, StartAnalysisResponse } from "@cr/shared";

export function useAnalyses(repositoryId?: string) {
  const params = repositoryId ? `?repositoryId=${repositoryId}` : "";
  return useQuery<AnalysesResponse>({
    queryKey: ["analyses", repositoryId],
    queryFn: () => api.get<AnalysesResponse>(`/analyses${params}`),
    staleTime: 30_000,
    enabled: repositoryId !== undefined,
  });
}

export function useAnalysis(id: string) {
  return useQuery<AnalysisDetail>({
    queryKey: ["analysis", id],
    queryFn: () => api.get<AnalysisDetail>(`/analyses/${id}`),
    enabled: !!id,
  });
}

export function useStartAnalysis() {
  const qc = useQueryClient();
  return useMutation<StartAnalysisResponse, Error, { repositoryId: string; branch?: string }>({
    mutationFn: (body) => api.post<StartAnalysisResponse>("/analyses", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analyses"] }),
  });
}
