import { Grid2X2, List, Search, Star } from "lucide-react";
import Link from "next/link";

import type { VideoFilters } from "@/lib/videos/types";
import { buildVideoQuery } from "@/lib/videos/utils";

export function VideoToolbar({ filters, categories }: { filters: VideoFilters; categories: string[] }) {
  return (
    <form action="/dashboard/videos" method="get" className="tech-panel rounded-[24px] p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_minmax(150px,.7fr)_minmax(150px,.7fr)_110px_auto] lg:items-end">
        <label className="text-xs font-semibold text-slate-400">
          Search
          <div className="mt-2 flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-cyan-300/45 focus-within:ring-2 focus-within:ring-cyan-300/15">
            <Search className="size-4 text-slate-400" />
            <input name="q" type="search" defaultValue={filters.q} placeholder="Search videos" className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-400">
          Category
          <select name="category" defaultValue={filters.category} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-400">
          Sort
          <select name="sort" defaultValue={filters.sort} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="most_viewed">Most viewed</option>
            <option value="size_desc">Largest</option>
            <option value="size_asc">Smallest</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-400">
          Show
          <select name="per_page" defaultValue={filters.perPage} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15">
            {[12, 24, 48, 96].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="tech-interactive h-11 flex-1 rounded-full border border-cyan-200/20 bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-[#04101d] shadow-[0_10px_24px_rgba(40,137,255,0.23)] hover:brightness-110">Apply</button>
          <Link href="/dashboard/videos" className="tech-interactive grid h-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.07]">Clear</Link>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <Link href={buildVideoQuery(filters, { favorite: !filters.favorite, page: 1 })} className={`tech-interactive inline-flex min-h-10 flex-1 items-center justify-center gap-2 sm:flex-none rounded-full border px-4 text-sm font-semibold ${filters.favorite ? "border-amber-300/25 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]"}`}>
          <Star className={`size-4 ${filters.favorite ? "fill-current" : ""}`} />
          {filters.favorite ? "Showing starred" : "Starred only"}
        </Link>
        <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          <Link href={buildVideoQuery(filters, { view: "grid", page: 1 })} aria-label="Grid view" className={`grid size-9 place-items-center rounded-full transition ${filters.view === "grid" ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"}`}>
            <Grid2X2 className="size-4" />
          </Link>
          <Link href={buildVideoQuery(filters, { view: "list", page: 1 })} aria-label="List view" className={`grid size-9 place-items-center rounded-full transition ${filters.view === "list" ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"}`}>
            <List className="size-4" />
          </Link>
        </div>
      </div>
      {filters.view !== "grid" ? <input type="hidden" name="view" value={filters.view} /> : null}
      {filters.favorite ? <input type="hidden" name="favorite" value="1" /> : null}
    </form>
  );
}
