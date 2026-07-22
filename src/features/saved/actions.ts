"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function removeOpportunityBookmarkAction(opportunityId: string) {
  const user = await requireUser();

  await getPrisma().opportunityBookmark.deleteMany({
    where: {
      userId: user.id,
      opportunityId,
    },
  });

  revalidatePath("/app/saved");
}

export async function removeProfileBookmarkAction(profileId: string) {
  const user = await requireUser();

  await getPrisma().profileBookmark.deleteMany({
    where: {
      userId: user.id,
      profileId,
    },
  });

  revalidatePath("/app/saved");
}
