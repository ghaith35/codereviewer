import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "./useMe.js";
import { api } from "../lib/api.js";

export function useAuth() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/";
    },
  });

  return {
    user: me ?? null,
    isLoading,
    isAuthenticated: !!me,
    logout: () => logoutMutation.mutate(),
  };
}
