import { ClipboardX } from "lucide-react";
import Link from "next/link";

export default function AssignmentNotFound() {
  return (
    <main className="grid min-h-[65vh] place-items-center">
      <section className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/[0.05] text-slate-400">
          <ClipboardX className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-100">Assignment not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          The assignment may have been deleted, archived, or is not available to this account.
        </p>
        <Link
          href="/dashboard/assignments"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Return to assignments
        </Link>
      </section>
    </main>
  );
}
