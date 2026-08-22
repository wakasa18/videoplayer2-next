import { ClipboardX } from "lucide-react";
import Link from "next/link";

export default function AssignmentNotFound() {
  return (
    <main className="grid min-h-[65vh] place-items-center">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e1e5ea] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f1f3f4] text-[#5f6368]">
          <ClipboardX className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[#202124]">Assignment not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">
          The assignment may have been deleted, archived, or is not available to this account.
        </p>
        <Link
          href="/dashboard/assignments"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
        >
          Return to assignments
        </Link>
      </section>
    </main>
  );
}
