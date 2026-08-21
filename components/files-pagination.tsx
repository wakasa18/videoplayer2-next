import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { FileBrowserFilters } from "@/lib/files/types";
import { buildFileQuery } from "@/lib/files/utils";

type FilesPaginationProps = {
  filters: FileBrowserFilters;
  page: number;
  totalPages: number;
  totalFiles: number;
};

export function FilesPagination({
  filters,
  page,
  totalPages,
  totalFiles,
}: FilesPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  return (
    <nav
      className="mt-6 flex flex-col items-center justify-between gap-3 rounded-[20px] border border-[#e1e5ea] bg-white px-4 py-3 shadow-sm sm:flex-row"
      aria-label="Files pagination"
    >
      <p className="text-xs text-[#80868b]">
        Page {page} of {totalPages} · {totalFiles.toLocaleString()} files
      </p>
      <div className="flex items-center gap-1">
        <PageLink
          href={buildFileQuery(filters, { page: Math.max(1, page - 1) })}
          disabled={page <= 1}
          label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PageLink>

        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="grid size-9 place-items-center text-sm text-[#80868b]"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={buildFileQuery(filters, { page: item })}
              aria-current={item === page ? "page" : undefined}
              className={`grid size-9 place-items-center rounded-full text-sm font-semibold transition ${
                item === page
                  ? "bg-[#e8f0fe] text-[#1967d2]"
                  : "text-[#5f6368] hover:bg-[#f1f3f4]"
              }`}
            >
              {item}
            </Link>
          ),
        )}

        <PageLink
          href={buildFileQuery(filters, {
            page: Math.min(totalPages, page + 1),
          })}
          disabled={page >= totalPages}
          label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="grid size-9 place-items-center rounded-full text-[#bdc1c6]"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
    >
      {children}
    </Link>
  );
}

function buildPages(page: number, totalPages: number) {
  const visible = new Set([1, totalPages, page - 1, page, page + 1]);
  const values = Array.from(visible)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  values.forEach((value, index) => {
    if (index > 0 && value - values[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });

  return result;
}
