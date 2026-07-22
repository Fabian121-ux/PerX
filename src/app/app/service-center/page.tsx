import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export default async function ServiceCenterPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const tickets = await getPrisma().supportTicket.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return (
    <AppSection
      title="Service Center"
      description="Get support for account access, marketplace workflows, deals, escrow, and trust issues."
      actions={<ButtonLink href="/app/service-center/new">Create Ticket</ButtonLink>}
    >
      {tickets.length > 0 ? (
        <div className="grid gap-4">
          {tickets.map(ticket => (
            <Card key={ticket.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-[color:var(--px-text)]">{ticket.subject}</h3>
                  <Badge className={
                    ticket.status === "OPEN" ? "bg-blue-100 text-blue-800" :
                    ticket.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" :
                    ticket.status === "CLOSED" ? "bg-slate-100 text-slate-800" :
                    "bg-[color:var(--px-warning)] text-white"
                  }>
                    {ticket.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">{ticket.category}</p>
                {ticket.messages.length > 0 && (
                  <p className="mt-2 text-sm text-[color:var(--px-text-muted)] line-clamp-2">
                    {ticket.messages[0].body}
                  </p>
                )}
                <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
                  Last updated {new Date(ticket.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No support tickets"
          body="You have no open or past support tickets. If you need help, open a new ticket."
          action={<ButtonLink href="/app/service-center/new">Create Ticket</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
