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
    <section className="rounded-[22px] border border-[#e1e5ea] bg-white p-4 shadow-sm">
      <form method="get" action="/dashboard/files" className="space-y-3">
        {filters.folder ? (
          <input type="hidden" name="folder" value={filters.folder} />
        ) : null}
        <input type="hidden" name="view" value={filters.view} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-full bg-[#f1f3f4] px-4 transition focus-within:bg-white focus-within:shadow-[0_1px_2px_rgba(60,64,67,.16),0_1px_3px_1px_rgba(60,64,67,.08)]">
            <Search className="size-5 shrink-0 text-[#5f6368]" aria-hidden="true" />
            <span className="sr-only">Search files and folders</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search this folder"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#202124] outline-none placeholder:text-[#80868b]"
            />
          </label>

          <div className="flex items-center gap-2">
            <Link
              href={buildFileQuery(filters, {
                favorite: !filters.favorite,
                page: 1,
              })}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                filters.favorite
                  ? "border-[#d2e3fc] bg-[#e8f0fe] text-[#1967d2]"
                  : "border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
              }`}
            >
              <Star
                className={`size-4 ${filters.favorite ? "fill-current" : ""}`}
                aria-hidden="true"
              />
              Favorites
            </Link>

            <div className="flex rounded-full border border-[#dadce0] bg-white p-1">
              <Link
                href={buildFileQuery(filters, { view: "grid", page: 1 })}
                className={`grid size-9 place-items-center rounded-full transition ${
                  filters.view === "grid"
                    ? "bg-[#e8f0fe] text-[#1967d2]"
                    : "text-[#5f6368] hover:bg-[#f1f3f4]"
                }`}
                aria-label="Grid view"
              >
                <Grid2X2 className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={buildFileQuery(filters, { view: "list", page: 1 })}
                className={`grid size-9 place-items-center rounded-full transition ${
                  filters.view === "list"
                    ? "bg-[#e8f0fe] text-[#1967d2]"
                    : "text-[#5f6368] hover:bg-[#f1f3f4]"
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
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
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
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
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
    <label className="grid gap-1.5 text-xs font-semibold text-[#5f6368]">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 rounded-xl border border-[#dadce0] bg-white px-3 text-sm font-medium text-[#202124] outline-none transition focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]"
      >
        {children}
      </select>
    </label>
  );
}
