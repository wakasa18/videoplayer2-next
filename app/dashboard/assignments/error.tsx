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
      <section className="w-full max-w-xl rounded-[28px] border border-[#f6c7c3] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fce8e6] text-[#c5221f]">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[#202124]">
          Assignments could not be loaded
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  );
}
