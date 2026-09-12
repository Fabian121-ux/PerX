"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { supportTicketSchema } from "@/lib/validation/support";
import { writeAuditLog } from "@/lib/logging/audit";

export type SupportTicketFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle";
};

function fieldErrorsFromIssues(error: {
  issues: { message: string; path: PropertyKey[] }[];
}) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field])
      errors[field] = issue.message;
    return errors;
  }, {});
}

export async function createSupportTicketAction(
  _previous: SupportTicketFormState,
  formData: FormData,
): Promise<SupportTicketFormState> {
  const user = await requireUser();

  const parsed = supportTicketSchema.safeParse({
    category: formData.get("category"),
    message: formData.get("message"),
    subject: formData.get("subject"),
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFromIssues(parsed.error);
    return {
      fieldErrors,
      message:
        "We could not send this request yet. Check the highlighted fields.",
      status: "error",
    };
  }

  let ticket: { id: string };
  try {
    ticket = await getPrisma().supportTicket.create({
      data: {
        authorId: user.id,
        subject: parsed.data.subject,
        category: parsed.data.category,
        status: "OPEN",
        messages: {
          create: {
            senderId: user.id,
            body: parsed.data.message,
          },
        },
      },
      select: { id: true },
    });
  } catch {
    return {
      message:
        "Support is temporarily unavailable. Your request was not sent; please try again.",
      status: "error",
    };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "support.ticket_created",
    entityId: ticket.id,
    entityType: "support_ticket",
  });

  revalidatePath("/app/service-center");
  redirect(`/app/service-center?created=${ticket.id}`);
}
