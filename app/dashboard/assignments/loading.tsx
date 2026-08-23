export default function AssignmentsLoading() {
  return (
    <main className="space-y-5" aria-busy="true" aria-label="Loading assignments">
      <section className="animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-sm sm:p-8">
        <div className="h-6 w-44 rounded-full bg-cyan-400/10" />
        <div className="mt-5 h-10 w-72 max-w-full rounded-xl bg-white/[0.08]" />
        <div className="mt-4 h-5 max-w-2xl rounded-lg bg-white/[0.05]" />
        <div className="mt-2 h-5 max-w-xl rounded-lg bg-white/[0.05]" />
      </section>
      <section className="animate-pulse rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 w-28 shrink-0 rounded-full bg-white/[0.05]" />
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.045] shadow-sm"
          />
        ))}
      </section>
    </main>
  );
}
