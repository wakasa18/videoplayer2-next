export default function AssignmentsLoading() {
  return (
    <main className="space-y-5" aria-busy="true" aria-label="Loading assignments">
      <section className="animate-pulse rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
        <div className="h-6 w-44 rounded-full bg-[#e8f0fe]" />
        <div className="mt-5 h-10 w-72 max-w-full rounded-xl bg-[#e8eaed]" />
        <div className="mt-4 h-5 max-w-2xl rounded-lg bg-[#f1f3f4]" />
        <div className="mt-2 h-5 max-w-xl rounded-lg bg-[#f1f3f4]" />
      </section>
      <section className="animate-pulse rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 w-28 shrink-0 rounded-full bg-[#f1f3f4]" />
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 rounded-2xl bg-[#f1f3f4]" />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm"
          />
        ))}
      </section>
    </main>
  );
}
