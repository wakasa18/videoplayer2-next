import { Grid2X2, List, Search, SlidersHorizontal, Star } from "lucide-react";
import Link from "next/link";

import type { FileBrowserFilters } from "@/lib/files/types";
import { buildFileQuery } from "@/lib/files/utils";

type FilesToolbarProps = {
  filters: FileBrowserFilters;
  categories: string[];
};

export function FilesToolbar({ filters, categories }: FilesToolbarProps) {
  return (
    <section className="tech-panel rounded-[22px] p-4">
      <form method="get" action="/dashboard/files" className="space-y-3">
        {filters.folder ? (
          <input type="hidden" name="folder" value={filters.folder} />
        ) : null}
        <input type="hidden" name="view" value={filters.view} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-cyan-300/40 focus-within:bg-white/[0.065] focus-within:ring-2 focus-within:ring-cyan-300/10">
            <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Search files and folders</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search this folder"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildFileQuery(filters, {
                favorite: !filters.favorite,
                page: 1,
              })}
              className={`tech-interactive inline-flex min-h-11 flex-1 items-center justify-center sm:flex-none gap-2 rounded-full border px-4 text-sm font-semibold ${
                filters.favorite
                  ? "border-amber-300/25 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]"
              }`}
            >
              <Star
                className={`size-4 ${filters.favorite ? "fill-current" : ""}`}
                aria-hidden="true"
              />
              Favorites
            </Link>

            <div className="ml-auto flex shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-1">
              <Link
                href={buildFileQuery(filters, { view: "grid", page: 1 })}
                className={`grid size-9 place-items-center rounded-full transition ${
                  filters.view === "grid"
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                }`}
                aria-label="Grid view"
              >
                <Grid2X2 className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={buildFileQuery(filters, { view: "list", page: 1 })}
                className={`grid size-9 place-items-center rounded-full transition ${
                  filters.view === "list"
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                }`}
                aria-label="List view"
              >
                <List className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <FilterSelect label="File type" name="type" defaultValue={filters.type}>
            <option value="">All file types</option>
            <option value="pdf">PDF</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
            <option value="spreadsheet">Spreadsheets</option>
            <option value="presentation">Presentations</option>
            <option value="archive">Archives</option>
            <option value="text">Text and code</option>
            <option value="other">Other</option>
          </FilterSelect>

          <FilterSelect
            label="Category"
            name="category"
            defaultValue={filters.category}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Sort" name="sort" defaultValue={filters.sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="size_desc">Largest first</option>
            <option value="size_asc">Smallest first</option>
          </FilterSelect>

          <FilterSelect
            label="Show"
            name="per_page"
            defaultValue={String(filters.perPage)}
          >
            <option value="12">12 items</option>
            <option value="24">24 items</option>
            <option value="48">48 items</option>
            <option value="96">96 items</option>
          </FilterSelect>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="tech-interactive inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-cyan-200/20 bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-[#04101d] shadow-[0_10px_24px_rgba(40,137,255,0.23)] hover:brightness-110"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Apply
            </button>
            <Link
              href={buildFileQuery(
                {
                  ...filters,
                  q: "",
                  type: "",
                  category: "",
                  favorite: false,
                  sort: "newest",
                  page: 1,
                },
                {},
              )}
              className="tech-interactive inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.07]"
            >
              Clear
            </Link>
          </div>
        </div>
      </form>
    </section>
  );
}

type FilterSelectProps = {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
};

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: FilterSelectProps) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15"
      >
        {children}
      </select>
    </label>
  );
}
