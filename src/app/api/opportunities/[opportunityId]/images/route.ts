import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { assertCanPublish } from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { hasCapability } from "@/lib/permissions/capabilities";
import {
  deleteListingImage,
  isListingImageStorageConfigured,
  uploadListingImage,
  validateListingImageFile,
} from "@/lib/uploads/listing-image";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ opportunityId: string }>;
};

function canUpdateOpportunities(roles: Parameters<typeof hasCapability>[0]) {
  return hasCapability(roles, "opportunity:update:own");
}

async function getOwnedOpportunity(opportunityId: string, userId: string) {
  return getPrisma().opportunity.findFirst({
    select: { id: true, ownerId: true, type: true },
    where: { id: opportunityId, ownerId: userId },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canUpdateOpportunities(user.roles)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const accountRestriction = await assertCanPublish(user.id);
  if (accountRestriction) {
    return NextResponse.json({ error: accountRestriction }, { status: 403 });
  }

  if (!isListingImageStorageConfigured()) {
    return NextResponse.json(
      { error: "Listing image storage is unavailable." },
      { status: 503 },
    );
  }

  const { opportunityId } = await context.params;
  const opportunity = await getOwnedOpportunity(opportunityId, user.id);
  if (!opportunity) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("image");
  const makeCover = formData.get("makeCover") !== "false";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  const validation = validateListingImageFile(file);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const stored = await uploadListingImage({
      extension: validation.extension,
      file,
      opportunityId,
      userId: user.id,
    });

    const image = await getPrisma().$transaction(async (tx) => {
      const existingCover = await tx.opportunityImage.findFirst({
        select: { id: true },
        where: { isCover: true, opportunityId },
      });
      const shouldCover = makeCover || !existingCover;
      if (shouldCover) {
        await tx.opportunityImage.updateMany({
          data: { isCover: false },
          where: { opportunityId },
        });
      }

      const created = await tx.opportunityImage.create({
        data: {
          byteSize: file.size,
          isCover: shouldCover,
          mimeType: file.type,
          opportunityId,
          storageKey: stored.key,
          uploaderId: user.id,
          url: stored.url,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "opportunity.image_uploaded",
          actorId: user.id,
          entityId: opportunityId,
          entityType: "opportunity",
          metadata: { imageId: created.id, isCover: shouldCover },
        },
      });

      return created;
    });

    return NextResponse.json({ image });
  } catch {
    return NextResponse.json(
      { error: "Listing image upload failed. Try again." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canUpdateOpportunities(user.roles)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const accountRestriction = await assertCanPublish(user.id);
  if (accountRestriction) {
    return NextResponse.json({ error: accountRestriction }, { status: 403 });
  }
  const { opportunityId } = await context.params;
  const opportunity = await getOwnedOpportunity(opportunityId, user.id);
  if (!opportunity) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { imageId?: string } | null;
  if (!body?.imageId) {
    return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  }

  const image = await getPrisma().opportunityImage.findFirst({
    select: { id: true },
    where: { id: body.imageId, opportunityId },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.opportunityImage.updateMany({
      data: { isCover: false },
      where: { opportunityId },
    });
    await tx.opportunityImage.update({
      data: { isCover: true },
      where: { id: image.id },
    });
    await tx.auditLog.create({
      data: {
        action: "opportunity.image_cover_selected",
        actorId: user.id,
        entityId: opportunityId,
        entityType: "opportunity",
        metadata: { imageId: image.id },
      },
    });
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canUpdateOpportunities(user.roles)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { opportunityId } = await context.params;
  const opportunity = await getOwnedOpportunity(opportunityId, user.id);
  if (!opportunity) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const imageId = url.searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  }

  const image = await getPrisma().opportunityImage.findFirst({
    where: { id: imageId, opportunityId },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.opportunityImage.delete({ where: { id: image.id } });
    if (image.isCover) {
      const replacement = await tx.opportunityImage.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
        where: { opportunityId },
      });
      if (replacement) {
        await tx.opportunityImage.update({
          data: { isCover: true },
          where: { id: replacement.id },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        action: "opportunity.image_removed",
        actorId: user.id,
        entityId: opportunityId,
        entityType: "opportunity",
        metadata: { imageId: image.id },
      },
    });
  });

  await deleteListingImage(image.storageKey);
  return NextResponse.json({ success: true });
}
