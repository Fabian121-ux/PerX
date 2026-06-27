"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { requireUser } from "@/lib/auth/session";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { profileSchema } from "@/lib/validation/auth";

function completeness(input: {
  headline: string;
  biography: string;
  location: string;
  skills?: string;
}) {
  let score = 30;
  if (input.headline.length >= 10) score += 20;
  if (input.biography.length >= 120) score += 25;
  if (input.location.length >= 2) score += 10;
  if (input.skills && input.skills.split(",").filter(Boolean).length >= 3)
    score += 15;
  return Math.min(score, 100);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/dashboard");
  if (!hasDatabaseUrl())
    redirect("/profile/edit?error=database-not-configured");

  const parsed = profileSchema.safeParse({
    biography: formData.get("biography"),
    headline: formData.get("headline"),
    location: formData.get("location"),
    skills: formData.get("skills"),
  });
  if (!parsed.success) redirect("/profile/edit?error=check-fields");

  const skillNames =
    parsed.data.skills
      ?.split(",")
      .map((skill) => skill.trim())
      .filter(Boolean) ?? [];
  const profileCompleteness = completeness(parsed.data);

  await getPrisma().profile.upsert({
    create: {
      biography: parsed.data.biography,
      headline: parsed.data.headline,
      location: parsed.data.location,
      profileCompleteness,
      skills: { create: skillNames.map((name) => ({ name })) },
      userId: user.id,
    },
    update: {
      biography: parsed.data.biography,
      headline: parsed.data.headline,
      location: parsed.data.location,
      profileCompleteness,
      skills: {
        deleteMany: {},
        create: skillNames.map((name) => ({ name })),
      },
    },
    where: { userId: user.id },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "profile.update",
    entityId: user.id,
    entityType: "profile",
  });
  redirect("/dashboard");
}
