export default function Loading() {
  return <main className="space-y-5"><div className="tech-panel h-52 animate-pulse rounded-[28px]" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="tech-panel h-24 animate-pulse rounded-[20px]" />)}</div><div className="tech-panel h-80 animate-pulse rounded-[24px]" /></main>;
}
