import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Film,
  History,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { getWorkspaceActivity, getWorkspaceSettingsData } from "@/lib/workspace/data";
import type { WorkspaceActivityItem, WorkspaceActivityModule } from "@/lib/workspace/types";
import {
  buildWorkspaceActivityQuery,
  formatWorkspaceDateTime,
  parseWorkspaceActivityFilters,
  summarizeActivityDetails,
  workspaceActionLabel,
  workspaceModuleLabel,
} from "@/lib/workspace/utils";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: Props) {
  const filters = parseWorkspaceActivityFilters(await searchParams);

  try {
    const [result, settings] = await Promise.all([
      getWorkspaceActivity(filters),
      getWorkspaceSettingsData(),
    ]);

    return (
      <main className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1967d2]">
                <History className="size-4" aria-hidden="true" />
                Unified audit history
              </div>
              <h1 className="text-3xl font-semibold tracking-[-.03em] text-[#202124] sm:text-4xl">
                Workspace activity
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6368] sm:text-base">
                Review file, assignment, video, and account-security actions in one owner-filtered timeline.
              </p>
            </div>
            <div className="rounded-2xl bg-[#f8f9fa] px-5 py-4 text-right">
              <span className="block text-xs font-semibold uppercase tracking-[.08em] text-[#80868b]">
                Matching events
              </span>
              <strong className="mt-1 block text-2xl font-semibold text-[#202124]">
                {result.totalItems.toLocaleString()}
              </strong>
            </div>
          </div>
        </section>

        <form
          action="/dashboard/activity"
          method="get"
          className="grid gap-3 rounded-[24px] border border-[#e1e5ea] bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"
        >
          <label className="grid gap-2 text-sm font-semibold text-[#3c4043]">
            Search activity
            <span className="flex h-12 items-center gap-3 rounded-2xl border border-[#dadce0] px-4 focus-within:border-[#1a73e8] focus-within:ring-4 focus-within:ring-[#e8f0fe]">
              <Search className="size-4 shrink-0 text-[#80868b]" aria-hidden="true" />
              <input
                name="q"
                defaultValue={filters.q}
                type="search"
                placeholder="Action, filename, title, or path"
                className="min-w-0 flex-1 bg-transparent text-sm font-normal text-[#202124] outline-none placeholder:text-[#9aa0a6]"
              />
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[#3c4043]">
            Module
            <select
              name="module"
              defaultValue={filters.module}
              className="h-12 rounded-2xl border border-[#dadce0] bg-white px-4 text-sm font-normal text-[#202124] outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#e8f0fe]"
            >
              <option value="">All modules</option>
              <option value="files">Files</option>
              <option value="assignments">Assignments</option>
              <option value="videos">Videos</option>
              <option value="security">Account</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1765cc]"
          >
            <Search className="size-4" aria-hidden="true" />
            Filter
          </button>
        </form>

        <section className="overflow-hidden rounded-[24px] border border-[#e1e5ea] bg-white shadow-sm">
          {result.items.length ? (
            <div className="divide-y divide-[#edf1f5]">
              {result.items.map((item) => (
                <ActivityRow
                  key={item.activity_key}
                  item={item}
                  timezone={settings.profile.timezone}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
                  <History className="size-7" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-[#202124]">
                  No matching activity
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5f6368]">
                  Clear the search or perform an action in Files, Assignments, Videos, or Settings.
                </p>
              </div>
            </div>
          )}
        </section>

        <ActivityPagination
          page={result.page}
          totalPages={result.totalPages}
          filters={filters}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-[#f2d6a1] bg-white p-8 shadow-sm">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#fef7e0] text-[#b06000]">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-[#202124]">
            Activity history needs Phase 7
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f6368]">
            {error instanceof Error ? error.message : "Activity could not be loaded."}
          </p>
          <div className="mt-5 rounded-2xl bg-[#f8f9fa] p-4 text-sm leading-6 text-[#3c4043]">
            Run <code>database/phase7_workspace_finalization.sql</code> after the earlier migration scripts.
          </div>
        </section>
      </main>
    );
  }
}

function ActivityRow({
  item,
  timezone,
}: {
  item: WorkspaceActivityItem;
  timezone: string;
}) {
  const href = activityHref(item);
  const content = (
    <>
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${moduleColor(item.module)}`}>
        {moduleIcon(item.module)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#202124]">
              {workspaceActionLabel(item.action)}
            </p>
            <p className="mt-1 truncate text-sm text-[#5f6368]">
              {summarizeActivityDetails(item.details)}
            </p>
          </div>
          <time className="shrink-0 text-xs font-medium text-[#80868b]" dateTime={item.created_at}>
            {formatWorkspaceDateTime(item.created_at, timezone)}
          </time>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#80868b]">
          <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1 font-semibold">
            {workspaceModuleLabel(item.module)}
          </span>
          {item.target_id ? <span>Item #{item.target_id}</span> : null}
        </div>
      </div>
    </>
  );

  return href ? (
    <Link href={href} className="flex gap-4 p-4 transition hover:bg-[#f8f9fa] sm:p-5">
      {content}
    </Link>
  ) : (
    <article className="flex gap-4 p-4 sm:p-5">{content}</article>
  );
}

function ActivityPagination({
  page,
  totalPages,
  filters,
}: {
  page: number;
  totalPages: number;
  filters: ReturnType<typeof parseWorkspaceActivityFilters>;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Activity pages" className="flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link
          href={buildWorkspaceActivityQuery(filters, { page: page - 1 })}
          className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Link>
      ) : null}
      <span className="rounded-full bg-[#f1f3f4] px-4 py-2 text-sm font-semibold text-[#5f6368]">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={buildWorkspaceActivityQuery(filters, { page: page + 1 })}
          className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}

function moduleIcon(module: WorkspaceActivityModule) {
  if (module === "files") return <FileText className="size-5" aria-hidden="true" />;
  if (module === "assignments") return <ClipboardList className="size-5" aria-hidden="true" />;
  if (module === "videos") return <Film className="size-5" aria-hidden="true" />;
  return <ShieldCheck className="size-5" aria-hidden="true" />;
}

function moduleColor(module: WorkspaceActivityModule): string {
  if (module === "files") return "bg-[#e8f0fe] text-[#1967d2]";
  if (module === "assignments") return "bg-[#fef7e0] text-[#a15c00]";
  if (module === "videos") return "bg-[#f3e8fd] text-[#8430a6]";
  return "bg-[#e6f4ea] text-[#137333]";
}

function activityHref(item: WorkspaceActivityItem): string | null {
  if (!item.target_id) return null;
  if (item.module === "files") return `/dashboard/files/${item.target_id}`;
  if (item.module === "assignments") return `/dashboard/assignments/${item.target_id}`;
  if (item.module === "videos") return `/dashboard/videos/${item.target_id}`;
  return null;
}
