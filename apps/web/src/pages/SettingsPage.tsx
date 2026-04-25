import { LogOut, Shield, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "../hooks/useMe.js";
import { api } from "../lib/api.js";

export function SettingsPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function logout() {
    await api.post("/auth/logout");
    queryClient.clear();
    navigate("/");
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        {/* Account */}
        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Account
          </h2>
          <div className="flex items-center gap-4">
            {me?.avatarUrl && (
              <img
                src={me.avatarUrl}
                alt={me.githubLogin}
                className="h-14 w-14 rounded-full ring-2 ring-zinc-700"
              />
            )}
            <div>
              <div className="font-semibold text-white">{me?.name ?? me?.githubLogin}</div>
              <div className="text-sm text-zinc-400">@{me?.githubLogin}</div>
              {me?.email && <div className="text-sm text-zinc-500">{me.email}</div>}
            </div>
          </div>
        </section>

        {/* Plan */}
        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Plan</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {me?.plan === "PRO" ? (
                <Star className="h-5 w-5 text-amber-400" />
              ) : (
                <Shield className="h-5 w-5 text-zinc-400" />
              )}
              <div>
                <div className="font-medium text-white">{me?.plan === "PRO" ? "Pro" : "Free"}</div>
                <div className="text-sm text-zinc-500">
                  {me?.plan === "FREE"
                    ? `${me.analysesUsedMtd ?? 0} / 3 analyses used this month`
                    : "Unlimited analyses"}
                </div>
              </div>
            </div>
            {me?.plan === "FREE" && (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-amber-500/30">
                Upgrade to Pro
              </span>
            )}
          </div>
        </section>

        {/* Danger */}
        <section className="rounded-xl border border-red-900/40 bg-zinc-900 p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-red-500/70">
            Danger zone
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Sign out</div>
              <div className="text-xs text-zinc-500">You'll be redirected to the landing page</div>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-400 transition hover:bg-red-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
