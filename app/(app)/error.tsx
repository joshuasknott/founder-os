"use client";

import Link from "next/link";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
      <div className="max-w-sm rounded-lg border border-red-500/15 bg-white p-5 text-sm text-text-secondary shadow-sm">
        <p className="font-semibold text-text-primary">Something went wrong</p>
        <p className="mt-2 leading-6">
          An unexpected error occurred. You can try again or return to the home
          page.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-black/[0.06] px-4 py-2 text-xs font-semibold text-text-secondary"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
