import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../hooks/useMe.js";

export function RequireAuth() {
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
      </div>
    );
  }

  if (isError || !data) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
