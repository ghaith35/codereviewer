import { Link } from "react-router-dom";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/dashboard" className="font-bold text-white">
          CodeReviewer
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.githubLogin}
              className="ml-2 h-7 w-7 rounded-full ring-1 ring-zinc-700"
            />
          )}
          <button
            onClick={logout}
            title="Sign out"
            className="ml-1 flex items-center rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
