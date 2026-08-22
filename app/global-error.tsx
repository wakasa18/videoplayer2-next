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
      <body className="m-0 bg-[#f8f9fa] font-sans text-[#202124]">
        <main className="grid min-h-screen place-items-center p-6">
          <section className="w-full max-w-xl rounded-[28px] border border-[#f3c7c3] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#fce8e6] text-3xl text-[#b3261e]">!</div>
            <h1 className="mt-5 text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-[#5f6368]">
              The error was reported to the private production system log. Retry the page, or open System Check after signing in.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full bg-[#1a73e8] px-6 py-3 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
