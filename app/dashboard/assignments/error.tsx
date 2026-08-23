"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AssignmentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[65vh] place-items-center">
      <section className="w-full max-w-xl rounded-[28px] border border-red-300/25 bg-white/[0.045] p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-400/10 text-red-300">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-100">
          Assignments could not be loaded
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  );
}
