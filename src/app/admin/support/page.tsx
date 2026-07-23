import { AdminSection } from "@/components/admin-section";
import { Card, EmptyState } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";

export default async function AdminSupportPage() {
  const tickets = await getPrisma().supportTicket.findMany({
    include: {
      _count: { select: { messages: true } },
      author: { select: { name: true, username: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <AdminSection
      description="Review support tickets, statuses, categories, and response volume."
      title="Support"
    >
      {tickets.length ? (
        <div className="grid gap-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--px-primary)]">
                    {ticket.category} · {ticket.status}
                  </p>
                  <h2 className="mt-1 font-bold text-[color:var(--px-text)]">{ticket.subject}</h2>
                  <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                    Opened by {ticket.author.username || ticket.author.name} · {ticket._count.messages} message(s)
                  </p>
                </div>
                <p className="text-xs text-[color:var(--px-text-muted)]">
                  Updated {ticket.updatedAt.toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState body="No support tickets are currently open." title="No support tickets" />
      )}
    </AdminSection>
  );
}
