interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-4xl text-zinc-600">⚠</div>
      <div>
        <p className="font-medium text-white">{title}</p>
        {message && <p className="mt-1 text-sm text-zinc-400">{message}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
