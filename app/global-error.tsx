"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/system/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "global-error-boundary",
        message: error.message || "Unknown application error",
        digest: error.digest ?? null,
        stack: error.stack ?? null,
        path: window.location.pathname,
        metadata: { userAgent: navigator.userAgent },
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body className="high-tech-theme m-0 min-h-screen bg-[#07101d] font-sans text-slate-100">
        <main className="grid min-h-screen place-items-center p-6">
          <section className="w-full max-w-xl rounded-[28px] border border-red-300/25 bg-white/[0.045] p-8 text-center shadow-sm">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-red-400/10 text-3xl text-red-300">!</div>
            <h1 className="mt-5 text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              The error was reported to the private production system log. Retry the page, or open System Check after signing in.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-6 py-3 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
