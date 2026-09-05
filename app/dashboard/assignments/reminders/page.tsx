import { AlertTriangle } from "lucide-react";

import { ReminderHistoryClient } from "@/components/assignments/reminder-history-client";
import { getReminderHistoryData } from "@/lib/assignments/reminder-history";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reminder History" };

export default async function ReminderHistoryPage() {
  try { return <ReminderHistoryClient data={await getReminderHistoryData()} />; }
  catch (error) { return <main className="grid min-h-[65vh] place-items-center"><section className="tech-panel max-w-2xl rounded-[28px] p-7"><AlertTriangle className="size-8 text-amber-300" /><h1 className="mt-4 text-2xl font-semibold text-slate-100">Reminder history needs the selected-features migration</h1><p className="mt-3 text-sm leading-6 text-slate-400">{error instanceof Error ? error.message : "Could not load reminder history."}</p><p className="mt-4 rounded-xl bg-white/[.04] p-3 text-sm text-slate-300">Run <code>database/phase13_selected_features.sql</code> in Supabase.</p></section></main>; }
}
