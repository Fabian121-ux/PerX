import { MessagesSkeleton } from "@/components/messages/messages-skeleton";

export default function MessagesLoading() {
  return (
    <section
      aria-label="Loading messages"
      className="h-[calc(100dvh-9rem)] min-h-96"
    >
      <MessagesSkeleton />
    </section>
  );
}
