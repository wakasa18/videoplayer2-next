import {
  AlertTriangle,
  ChevronRight,
  FolderOpen,
  HardDrive,
  SearchX,
} from "lucide-react";
import Link from "next/link";

import { FileGrid } from "@/components/file-grid";
import { FilesActions } from "@/components/files-actions";
import { FileList } from "@/components/file-list";
import { FilesPagination } from "@/components/files-pagination";
import { FilesToolbar } from "@/components/files-toolbar";
import { FolderCard } from "@/components/folder-card";
import { getImportantFilesBrowser } from "@/lib/files/data";
import { getMaxUploadBytes } from "@/lib/files/server";
import type { FileBrowserFilters } from "@/lib/files/types";
import {
  buildFileQuery,
  formatBytes,
  parseFileBrowserFilters,
} from "@/lib/files/utils";

type FilesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: "Important Files",
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const filters = parseFileBrowserFilters(await searchParams);
  const maxUploadBytes = getMaxUploadBytes();

  let result: Awaited<ReturnType<typeof getImportantFilesBrowser>> | null = null;
  let loadError: string | null = null;

  try {
    result = await getImportantFilesBrowser(filters);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (!result) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-[#f2d6a1] bg-white p-7 shadow-sm sm:p-9">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#fef7e0] text-[#b06000]">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-[#202124]">
            Important Files needs server access
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f6368]">
            {loadError ?? "The file data could not be loaded."}
          </p>
          <div className="mt-5 rounded-2xl bg-[#f8f9fa] p-4 text-sm leading-6 text-[#3c4043]">
            Add <code>SUPABASE_SERVICE_ROLE_KEY</code> and optional{" "}
            <code>SUPABASE_FILES_BUCKET</code> to <code>.env.local</code>, then
            restart the development server. Never prefix the service-role key
            with <code>NEXT_PUBLIC_</code>.
          </div>
        </section>
      </main>
    );
  }

  return (
      <main className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e6f4ea] px-3 py-1.5 text-xs font-semibold text-[#137333]">
                <HardDrive className="size-4" aria-hidden="true" />
                Uploads enabled
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#202124] sm:text-4xl">
                {filters.favorite
                  ? "Starred files"
                  : filters.folder.split("/").at(-1) || "Important Files"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6368] sm:text-base">
                Browse, preview, and download private files. You can now upload
                individual files, complete folders, and create empty folders.
              </p>
            </div>

            <div className="space-y-4">
              <FilesActions
                currentFolder={filters.folder}
                categories={result.categories}
                maxUploadBytes={maxUploadBytes}
                folderTableAvailable={result.folderTableAvailable}
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Summary label="Files" value={result.totalFiles.toLocaleString()} />
                <Summary label="Folders" value={result.folders.length.toLocaleString()} />
                <Summary label="Size" value={formatBytes(result.totalBytes)} />
              </div>
            </div>
          </div>
        </section>

        {!result.folderTableAvailable ? (
          <div className="flex items-start gap-3 rounded-[18px] border border-[#f2d6a1] bg-[#fef7e0] p-4 text-sm text-[#8d4e00]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              File uploads work, but empty folder creation is disabled until you run{" "}
              <code>database/phase3a_important_folders.sql</code> in the Supabase SQL Editor.
            </p>
          </div>
        ) : null}

        {!filters.favorite ? (
          <nav
            aria-label="Folder breadcrumb"
            className="flex items-center gap-1 overflow-x-auto rounded-[18px] border border-[#e1e5ea] bg-white px-3 py-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {result.breadcrumbs.map((crumb, index) => (
              <span key={crumb.path || "root"} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight
                    className="size-4 shrink-0 text-[#9aa0a6]"
                    aria-hidden="true"
                  />
                ) : null}
                <Link
                  href={buildFileQuery(filters, {
                    folder: crumb.path,
                    page: 1,
                  })}
                  aria-current={
                    index === result.breadcrumbs.length - 1 ? "page" : undefined
                  }
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${
                    index === result.breadcrumbs.length - 1
                      ? "bg-[#e8f0fe] text-[#1967d2]"
                      : "text-[#5f6368] hover:bg-[#f1f3f4]"
                  }`}
                >
                  {crumb.label}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}

        <FilesToolbar filters={filters} categories={result.categories} />

        {result.truncated ? (
          <div className="flex items-start gap-3 rounded-[18px] border border-[#f2d6a1] bg-[#fef7e0] p-4 text-sm text-[#8d4e00]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              This migration currently loads the first 5,000 active records. Database-side
              pagination will replace this temporary snapshot limit in a later phase.
            </p>
          </div>
        ) : null}

        {result.folders.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#80868b]">
                  Directory
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#202124]">
                  Folders
                </h2>
              </div>
              <span className="rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-semibold text-[#5f6368]">
                {result.folders.length} folder
                {result.folders.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.folders.map((folder, index) => (
                <FolderCard
                  key={folder.path}
                  folder={folder}
                  filters={filters}
                  index={index}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#80868b]">
                Files
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#202124]">
                {filters.favorite ? "Favorites" : "Files in this location"}
              </h2>
            </div>
            <span className="rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-semibold text-[#5f6368]">
              {result.totalFiles.toLocaleString()} result
              {result.totalFiles === 1 ? "" : "s"}
            </span>
          </div>

          {result.files.length > 0 ? (
            filters.view === "list" ? (
              <FileList files={result.files} />
            ) : (
              <FileGrid files={result.files} />
            )
          ) : (
            <EmptyFiles filters={filters} />
          )}

          <FilesPagination
            filters={filters}
            page={result.page}
            totalPages={result.totalPages}
            totalFiles={result.totalFiles}
          />
        </section>

        <p className="text-center text-xs text-[#9aa0a6]">
          Data access: {result.accessMode === "service-role" ? "secure server client" : "authenticated session policies"}
        </p>
      </main>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] px-4 py-3">
      <span className="block text-xs font-medium text-[#80868b]">{label}</span>
      <strong className="mt-1 block truncate text-lg font-semibold text-[#202124]">
        {value}
      </strong>
    </div>
  );
}

function EmptyFiles({ filters }: { filters: FileBrowserFilters }) {
  const filtered = Boolean(
    filters.q || filters.type || filters.category || filters.favorite,
  );

  return (
    <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[#c6dafc] bg-white p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
          {filtered ? (
            <SearchX className="size-7" aria-hidden="true" />
          ) : (
            <FolderOpen className="size-7" aria-hidden="true" />
          )}
        </span>
        <h3 className="mt-5 text-lg font-semibold text-[#202124]">
          {filtered ? "No matching files" : "This location is empty"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#5f6368]">
          {filtered
            ? "Try clearing a filter or using a different search term."
            : "No active files are stored directly in this folder."}
        </p>
      </div>
    </div>
  );
}
