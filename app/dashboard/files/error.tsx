"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function FilesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[68vh] place-items-center">
      <section className="w-full max-w-xl rounded-[28px] border border-red-300/25 bg-white/[0.045] p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-400/10 text-red-300">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-100">
          Files could not be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {error.message || "An unexpected error occurred while loading the file browser."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  );
}
