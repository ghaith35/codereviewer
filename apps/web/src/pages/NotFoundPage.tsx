import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-bold text-zinc-700">404</div>
      <p className="text-zinc-400">Page not found</p>
      <Link
        to="/"
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
      >
        Go home
      </Link>
    </main>
  );
}
