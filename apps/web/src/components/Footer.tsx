export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-zinc-600">
        <span>© {new Date().getFullYear()} CodeReviewer</span>
        <span>Free tier · 3 analyses / month · public repos</span>
      </div>
    </footer>
  );
}
