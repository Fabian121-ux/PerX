"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { supportTicketSchema } from "@/lib/validation/support";
import { writeAuditLog } from "@/lib/logging/audit";

export async function createSupportTicketAction(formData: FormData) {
  const user = await requireUser();

  const parsed = supportTicketSchema.safeParse({
    category: formData.get("category"),
    message: formData.get("message"),
    subject: formData.get("subject"),
  });

  if (!parsed.success) {
    throw new Error("Please check the support ticket fields and try again.");
  }

  const ticket = await getPrisma().supportTicket.create({
    data: {
      authorId: user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      status: "OPEN",
      messages: {
        create: {
          senderId: user.id,
          body: parsed.data.message
        }
      }
    }
  });

  await writeAuditLog({
    actorId: user.id,
    action: "support.ticket_created",
    entityId: ticket.id,
    entityType: "support_ticket",
  });

  revalidatePath("/app/service-center");
  redirect("/app/service-center");
}
