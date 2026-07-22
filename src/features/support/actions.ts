"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function createSupportTicketAction(formData: FormData) {
  const user = await requireUser();
  
  const subject = formData.get("subject") as string;
  const category = formData.get("category") as string;
  const message = formData.get("message") as string;

  if (!subject || !category || !message) {
    throw new Error("All fields are required");
  }

  await getPrisma().supportTicket.create({
    data: {
      authorId: user.id,
      subject,
      category,
      status: "OPEN",
      messages: {
        create: {
          senderId: user.id,
          body: message
        }
      }
    }
  });

  revalidatePath("/app/service-center");
  redirect("/app/service-center");
}
