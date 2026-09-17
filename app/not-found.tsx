import Link from "next/link";
import { FileQuestion } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-white/[0.035] p-6">
      <section className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FileQuestion className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[.18em] text-slate-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">The link may be old, incomplete, or no longer available.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-full workspace-primary px-6 py-3 text-sm font-semibold text-white">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
