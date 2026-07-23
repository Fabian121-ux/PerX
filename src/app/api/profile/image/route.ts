import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  deleteProfileImage,
  isProfileImageStorageConfigured,
  uploadProfileImage,
  validateProfileImageFile,
} from "@/lib/uploads/profile-image";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!isProfileImageStorageConfigured()) {
    return NextResponse.json(
      { error: "Profile image storage is unavailable." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  const validation = validateProfileImageFile(file);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const previous = await getPrisma().user.findUnique({
    select: {
      imageStorageKey: true,
      profile: { select: { profileImageStorageKey: true } },
    },
    where: { id: user.id },
  });

  try {
    const stored = await uploadProfileImage({
      extension: validation.extension,
      file,
      userId: user.id,
    });

    await getPrisma().$transaction(async (tx) => {
      await tx.user.update({
        data: {
          imageStorageKey: stored.key,
          imageUrl: stored.url,
        },
        where: { id: user.id },
      });

      await tx.profile.updateMany({
        data: {
          profileImageStorageKey: stored.key,
          profileImageUrl: stored.url,
        },
        where: { userId: user.id },
      });

      await tx.auditLog.create({
        data: {
          action: "profile.image_uploaded",
          actorId: user.id,
          entityId: user.id,
          entityType: "profile",
          metadata: { replacedExistingImage: Boolean(previous?.imageStorageKey) },
        },
      });
    });

    await deleteProfileImage(
      previous?.profile?.profileImageStorageKey ?? previous?.imageStorageKey,
    );

    return NextResponse.json({ imageUrl: stored.url });
  } catch {
    return NextResponse.json(
      { error: "Profile image upload failed. Try again." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const previous = await getPrisma().user.findUnique({
    select: {
      imageStorageKey: true,
      profile: { select: { profileImageStorageKey: true } },
    },
    where: { id: user.id },
  });

  await getPrisma().$transaction(async (tx) => {
    await tx.user.update({
      data: { imageStorageKey: null, imageUrl: null },
      where: { id: user.id },
    });
    await tx.profile.updateMany({
      data: { profileImageStorageKey: null, profileImageUrl: null },
      where: { userId: user.id },
    });
    await tx.auditLog.create({
      data: {
        action: "profile.image_removed",
        actorId: user.id,
        entityId: user.id,
        entityType: "profile",
      },
    });
  });

  await deleteProfileImage(
    previous?.profile?.profileImageStorageKey ?? previous?.imageStorageKey,
  );

  return NextResponse.json({ imageUrl: null });
}
