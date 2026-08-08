export default function ConversationLoading() {
  return (
    <section
      aria-label="Loading conversation"
      className="grid h-[100dvh] min-h-96 animate-pulse grid-rows-[4rem_minmax(0,1fr)_6rem] bg-[color:var(--px-surface)]"
    >
      <div className="border-b border-[color:var(--px-border)] bg-[color:var(--px-muted)]" />
      <div className="bg-[color:var(--px-page)]" />
      <div className="border-t border-[color:var(--px-border)] bg-[color:var(--px-muted)]" />
    </section>
  );
}
