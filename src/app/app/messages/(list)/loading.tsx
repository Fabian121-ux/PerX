export default function MessagesLoading() {
  return (
    <section
      aria-label="Loading messages"
      className="grid h-[calc(100dvh-9rem)] min-h-96 animate-pulse gap-4 rounded-[24px] bg-[color:var(--px-surface)] p-4 shadow-sm ring-1 ring-[color:var(--px-border)] lg:grid-cols-[300px_minmax(0,1fr)]"
    >
      <div className="rounded-2xl bg-[color:var(--px-muted)]" />
      <div className="rounded-2xl bg-[color:var(--px-muted)]" />
    </section>
  );
}
