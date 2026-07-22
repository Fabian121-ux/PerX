"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function requestConnectionAction(targetUserId: string) {
  const user = await requireUser();

  if (user.id === targetUserId) {
    throw new Error("Cannot connect with yourself");
  }

  // Check if connection already exists
  const existing = await getPrisma().connection.findFirst({
    where: {
      OR: [
        { requesterId: user.id, receiverId: targetUserId },
        { requesterId: targetUserId, receiverId: user.id },
      ],
    },
  });

  if (existing) {
    throw new Error("Connection already exists or is pending");
  }

  await getPrisma().connection.create({
    data: {
      requesterId: user.id,
      receiverId: targetUserId,
      status: "PENDING",
    },
  });

  revalidatePath("/app/network");
}

export async function acceptConnectionAction(connectionId: string) {
  const user = await requireUser();

  const connection = await getPrisma().connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== user.id) throw new Error("Unauthorized");

  await getPrisma().connection.update({
    where: { id: connectionId },
    data: { status: "ACCEPTED" },
  });

  revalidatePath("/app/network");
}

export async function rejectConnectionAction(connectionId: string) {
  const user = await requireUser();

  const connection = await getPrisma().connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== user.id && connection.requesterId !== user.id) {
    throw new Error("Unauthorized");
  }

  await getPrisma().connection.delete({
    where: { id: connectionId },
  });

  revalidatePath("/app/network");
}

export async function disconnectAction(connectionId: string) {
  const user = await requireUser();

  const connection = await getPrisma().connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== user.id && connection.requesterId !== user.id) {
    throw new Error("Unauthorized");
  }

  await getPrisma().connection.delete({
    where: { id: connectionId },
  });

  revalidatePath("/app/network");
}
