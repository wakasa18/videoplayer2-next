export default function FilesLoading() {
  return (
    <main className="space-y-5" aria-label="Loading Important Files">
      <div className="h-52 animate-pulse rounded-[28px] border border-[#e1e5ea] bg-white" />
      <div className="h-40 animate-pulse rounded-[22px] border border-[#e1e5ea] bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-[22px] border border-[#e1e5ea] bg-white"
          />
        ))}
      </div>
    </main>
  );
}
