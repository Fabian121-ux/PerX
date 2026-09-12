import type { RoleName } from "@/lib/permissions/capabilities";
import { hasCapability } from "@/lib/permissions/capabilities";
import { getPrisma } from "@/lib/db/prisma";

export const SUPPORT_MESSAGE_HISTORY_LIMIT = 100;

export async function getSupportTicketDetail({
  ticketId,
  userId,
  roles,
}: {
  ticketId: string;
  userId: string;
  roles: RoleName[];
}) {
  const canManageSupport = hasCapability(roles, "support:manage");
  const ticket = await getPrisma().supportTicket.findFirst({
    select: {
      authorId: true,
      category: true,
      createdAt: true,
      id: true,
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          body: true,
          createdAt: true,
          id: true,
          sender: { select: { id: true, name: true, username: true } },
        },
        take: SUPPORT_MESSAGE_HISTORY_LIMIT,
      },
      status: true,
      subject: true,
      updatedAt: true,
    },
    where: {
      id: ticketId,
      ...(canManageSupport ? {} : { authorId: userId }),
    },
  });

  if (!ticket) return null;

  return { ...ticket, messages: ticket.messages.toReversed() };
}
