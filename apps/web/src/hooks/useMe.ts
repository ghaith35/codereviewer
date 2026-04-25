import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import type { MeResponse } from "@cr/shared";

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
