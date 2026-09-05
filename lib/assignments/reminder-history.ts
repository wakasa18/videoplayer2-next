import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ReminderHistoryItem = {
  id: number;
  assignment_id: number | null;
  event_type: string;
  title: string;
  message: string;
  email_status: string | null;
  email_attempts: number;
  email_error: string | null;
  email_last_attempt_at: string | null;
  emailed_at: string | null;
  created_at: string;
};

export type AutomationRunItem = {
  id: number | string;
  run_source: string;
  reminders_created: number;
  recurrences_created: number;
  emails_requested: number;
  errors: string[] | null;
  started_at: string;
  finished_at: string | null;
};

export async function getReminderHistoryData() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/auth/login");

  const [notifications, runs] = await Promise.all([
    client.from("assignment_notifications").select("id,assignment_id,event_type,title,message,email_status,email_attempts,email_error,email_last_attempt_at,emailed_at,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(120),
    client.from("assignment_automation_runs").select("id,run_source,reminders_created,recurrences_created,emails_requested,errors,started_at,finished_at").or(`owner_id.eq.${user.id},owner_id.is.null`).order("started_at", { ascending: false }).limit(30),
  ]);
  if (notifications.error) throw new Error(notifications.error.message);
  if (runs.error) throw new Error(runs.error.message);
  const items = (notifications.data ?? []) as ReminderHistoryItem[];
  const runItems = (runs.data ?? []) as AutomationRunItem[];
  return {
    items,
    runs: runItems,
    sent: items.filter((item) => item.email_status === "sent" || item.emailed_at).length,
    failed: items.filter((item) => item.email_status === "failed").length,
    pending: items.filter((item) => item.email_status === "pending" || item.email_status === "retrying").length,
    lastCronRun: runItems.find((run) => run.run_source === "cron") ?? null,
  };
}
