import { AlertTriangle, StickyNote } from "@/components/ui/icons";

import { NotesBoard } from "@/components/notes/notes-board";
import { getNotesData } from "@/lib/notes/data";

export const metadata = { title: "Notes" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const openNew = params.new === "1" || params.new === "true";
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const focusId = Number.parseInt(String(params.note ?? ""), 10) || 0;

  let data: Awaited<ReturnType<typeof getNotesData>>;
  try {
    data = await getNotesData();
  } catch (error) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="tech-card w-full max-w-2xl rounded-[28px] border border-red-300/20 p-6 sm:p-8">
          <span className="grid size-14 place-items-center rounded-2xl bg-red-400/10 text-red-300">
            <AlertTriangle className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-slate-100">Notes could not load</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {error instanceof Error ? error.message : "Unexpected Notes error."}
          </p>
        </section>
      </main>
    );
  }

  if (!data.tableAvailable) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="tech-card w-full max-w-2xl rounded-[28px] border border-amber-300/20 p-6 sm:p-8">
          <span className="grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
            <StickyNote className="size-7" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.12em] text-primary">Notes module</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Run the Notes database upgrade</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Open Supabase SQL Editor and run <code className="text-primary">database/notes_reminders_upgrade.sql</code>, then refresh this page.
          </p>
        </section>
      </main>
    );
  }

  return <NotesBoard initialNotes={data.notes} openNew={openNew} focusId={focusId} initialQuery={initialQuery} />;
}
