import { Github } from "lucide-react";
import { API_ORIGIN } from "../lib/api.js";

export function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-white">CodeReviewer</h1>
        <p className="text-lg text-zinc-400">
          AI-powered code review for your GitHub repositories.
          <br />
          Static analysis + Gemini, delivered in under 3 minutes.
        </p>
      </div>

      <a
        href={`${API_ORIGIN}/api/auth/github`}
        className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        <Github className="h-4 w-4" />
        Login with GitHub
      </a>

      <p className="text-xs text-zinc-600">Free tier: 3 analyses/month · public repos</p>
    </main>
  );
}
