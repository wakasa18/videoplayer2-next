import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f9fa] p-6">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e1e5ea] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
          <FileQuestion className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[.18em] text-[#80868b]">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#202124]">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">The link may be old, incomplete, or no longer available.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-[#1a73e8] px-6 py-3 text-sm font-semibold text-white">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
