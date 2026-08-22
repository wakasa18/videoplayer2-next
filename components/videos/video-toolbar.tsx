import { Grid2X2, List, Search, Star } from "lucide-react";
import Link from "next/link";

import type { VideoFilters } from "@/lib/videos/types";
import { buildVideoQuery } from "@/lib/videos/utils";

export function VideoToolbar({ filters, categories }: { filters: VideoFilters; categories: string[] }) {
  return (
    <form action="/dashboard/videos" method="get" className="rounded-[24px] border border-[#e1e5ea] bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_minmax(150px,.7fr)_minmax(150px,.7fr)_110px_auto] lg:items-end">
        <label className="text-xs font-semibold text-[#5f6368]">Search<div className="mt-2 flex h-11 items-center gap-2 rounded-2xl border border-[#dadce0] px-3 focus-within:border-[#8ab4f8] focus-within:ring-4 focus-within:ring-[#e8f0fe]"><Search className="size-4 text-[#80868b]" /><input name="q" type="search" defaultValue={filters.q} placeholder="Search videos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div></label>
        <label className="text-xs font-semibold text-[#5f6368]">Category<select name="category" defaultValue={filters.category} className="mt-2 h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-3 text-sm outline-none focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]"><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="text-xs font-semibold text-[#5f6368]">Sort<select name="sort" defaultValue={filters.sort} className="mt-2 h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-3 text-sm outline-none focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="most_viewed">Most viewed</option><option value="size_desc">Largest</option><option value="size_asc">Smallest</option></select></label>
        <label className="text-xs font-semibold text-[#5f6368]">Show<select name="per_page" defaultValue={filters.perPage} className="mt-2 h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-3 text-sm outline-none focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]">{[12,24,48,96].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <div className="flex gap-2"><button type="submit" className="h-11 flex-1 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white hover:bg-[#1557b0]">Apply</button><Link href="/dashboard/videos" className="grid h-11 place-items-center rounded-full border border-[#dadce0] px-4 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]">Clear</Link></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1f3] pt-4">
        <Link href={buildVideoQuery(filters, { favorite: !filters.favorite, page: 1 })} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${filters.favorite ? "bg-[#fef7e0] text-[#a15c00]" : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"}`}><Star className={`size-4 ${filters.favorite ? "fill-current" : ""}`} />{filters.favorite ? "Showing starred" : "Starred only"}</Link>
        <div className="flex rounded-full border border-[#dadce0] bg-white p-1"><Link href={buildVideoQuery(filters, { view: "grid", page: 1 })} aria-label="Grid view" className={`grid size-9 place-items-center rounded-full ${filters.view === "grid" ? "bg-[#e8f0fe] text-[#1967d2]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}><Grid2X2 className="size-4" /></Link><Link href={buildVideoQuery(filters, { view: "list", page: 1 })} aria-label="List view" className={`grid size-9 place-items-center rounded-full ${filters.view === "list" ? "bg-[#e8f0fe] text-[#1967d2]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}><List className="size-4" /></Link></div>
      </div>
      {filters.view !== "grid" ? <input type="hidden" name="view" value={filters.view} /> : null}
      {filters.favorite ? <input type="hidden" name="favorite" value="1" /> : null}
    </form>
  );
}
