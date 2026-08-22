export default function VideosLoading() {
  return <main className="space-y-5" aria-busy="true" aria-label="Loading videos"><div className="h-52 animate-pulse rounded-[28px] bg-white shadow-sm" /><div className="h-36 animate-pulse rounded-[24px] bg-white shadow-sm" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[1.12] animate-pulse rounded-[24px] bg-white shadow-sm" />)}</div></main>;
}
