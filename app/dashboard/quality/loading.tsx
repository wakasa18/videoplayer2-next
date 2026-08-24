export default function QualityLoading() {
  return (
    <main className="space-y-5" aria-label="Loading quality assurance dashboard">
      <section className="tech-panel h-52 animate-pulse rounded-[28px]" />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="tech-panel h-28 animate-pulse rounded-[22px]" />
        ))}
      </section>
      <section className="tech-panel h-96 animate-pulse rounded-[24px]" />
    </main>
  );
}
