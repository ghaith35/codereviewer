import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import type { ReposResponse, SyncResponse } from "@cr/shared";

export function useRepos(page = 1, q?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  return useQuery<ReposResponse>({
    queryKey: ["repos", page, q],
    queryFn: () => api.get<ReposResponse>(`/repos?${params}`),
    staleTime: 60_000,
  });
}

export function useSyncRepos() {
  const qc = useQueryClient();
  return useMutation<SyncResponse>({
    mutationFn: () => api.post<SyncResponse>("/repos/sync"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}
