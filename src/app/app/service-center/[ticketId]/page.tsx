import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupportTicketDetail } from "@/features/support/data";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const user = await requireUser();
  const { ticketId } = await params;
  const ticket = await getSupportTicketDetail({
    roles: user.roles,
    ticketId,
    userId: user.id,
  });

  if (!ticket) notFound();

  return (
    <AppSection
      actions={
        <ButtonLink href="/app/service-center" variant="secondary">
          <ArrowLeft aria-hidden className="mr-1.5" size={16} />
          Service Center
        </ButtonLink>
      }
      description={`Opened ${ticket.createdAt.toLocaleString()} · Updated ${ticket.updatedAt.toLocaleString()}`}
      title={ticket.subject}
    >
      <div className="grid gap-4">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{ticket.category}</Badge>
            <Badge>{ticket.status.replaceAll("_", " ")}</Badge>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black text-[color:var(--px-text)]">
            Request history
          </h2>
          <div className="mt-4 grid gap-3">
            {ticket.messages.map((message) => {
              const sentByViewer = message.sender.id === user.id;
              const sentByRequester = message.sender.id === ticket.authorId;
              const senderLabel = sentByViewer
                ? "You"
                : sentByRequester
                  ? message.sender.name
                  : "PreX support";

              return (
                <article
                  className={`max-w-[92%] rounded-[var(--px-radius-sm)] p-4 sm:max-w-[78%] ${
                    sentByViewer
                      ? "ml-auto bg-[color:var(--px-primary)] text-white"
                      : "bg-[color:var(--px-surface-soft)] text-[color:var(--px-text)]"
                  }`}
                  key={message.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                    <span>{senderLabel}</span>
                    <time dateTime={message.createdAt.toISOString()}>
                      {message.createdAt.toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                    {message.body}
                  </p>
                </article>
              );
            })}
          </div>
        </Card>
      </div>
    </AppSection>
  );
}
