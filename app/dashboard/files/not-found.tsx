import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";

export default function FileNotFound() {
  return (
    <main className="grid min-h-[68vh] place-items-center">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e1e5ea] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f1f3f4] text-[#5f6368]">
          <FileQuestion className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[#202124]">
          File not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#5f6368]">
          The file may have been deleted, moved, or is no longer active.
        </p>
        <Link
          href="/dashboard/files"
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Return to Important Files
        </Link>
      </section>
    </main>
  );
}
