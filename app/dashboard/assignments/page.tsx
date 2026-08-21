import { ClipboardList } from "lucide-react";

export default function AssignmentsPlaceholderPage() {
  return (
    <main className="grid min-h-[60vh] place-items-center">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e1e5ea] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
          <ClipboardList className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#202124]">
          Assignments
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#5f6368]">
          This module will be migrated after the read-only Important Files page.
        </p>
      </section>
    </main>
  );
}
