"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { requireUser } from "@/lib/auth/session";
import { profileSchema } from "@/lib/validation/auth";

function completeness(input: {
  headline: string;
  biography: string;
  location: string;
  profileImageUrl?: string;
  skills?: string;
  websiteUrl?: string;
}) {
  let score = 30;
  if (input.headline.length >= 10) score += 20;
  if (input.biography.length >= 120) score += 25;
  if (input.location.length >= 2) score += 10;
  if (input.skills && input.skills.split(",").filter(Boolean).length >= 3)
    score += 10;
  if (input.profileImageUrl) score += 5;
  if (input.websiteUrl) score += 5;
  return Math.min(score, 100);
}

function checkboxValue(
  formData: FormData,
  name: string,
  defaultValue: boolean,
) {
  const values = formData.getAll(name).map(String);
  if (!values.length) return defaultValue;
  return values.includes("on");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") redirect("/app?mock=true");
  if (!hasDatabaseUrl())
    redirect("/app/profile/edit?error=database-not-configured");

  const parsed = profileSchema.safeParse({
    biography: formData.get("biography"),
    headline: formData.get("headline"),
    location: formData.get("location"),
    profileImageUrl: formData.get("profileImageUrl"),
    skills: formData.get("skills"),
    websiteUrl: formData.get("websiteUrl"),
    isDiscoverable: checkboxValue(formData, "isDiscoverable", true),
    showLocation: checkboxValue(formData, "showLocation", true),
    showSkills: checkboxValue(formData, "showSkills", true),
    allowConnectionRequests: checkboxValue(
      formData,
      "allowConnectionRequests",
      true,
    ),
    allowMessagesFromConnections:
      checkboxValue(formData, "allowMessagesFromConnections", true),
    allowMessagesFromMembers: checkboxValue(
      formData,
      "allowMessagesFromMembers",
      false,
    ),
  });
  if (!parsed.success) redirect("/app/profile/edit?error=check-fields");

  const skillList =
    parsed.data.skills
      ?.split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0) ?? [];

  const profileCompleteness = completeness(parsed.data);

  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.user.update({
        data: { imageUrl: parsed.data.profileImageUrl || null },
        where: { id: user.id },
      });

      await tx.profile.upsert({
        create: {
          biography: parsed.data.biography,
          headline: parsed.data.headline,
          allowConnectionRequests: parsed.data.allowConnectionRequests,
          allowMessagesFromConnections:
            parsed.data.allowMessagesFromConnections,
          allowMessagesFromMembers: parsed.data.allowMessagesFromMembers,
          isDiscoverable: parsed.data.isDiscoverable,
          location: parsed.data.location,
          profileCompleteness: profileCompleteness,
          profileImageUrl: parsed.data.profileImageUrl || null,
          showLocation: parsed.data.showLocation,
          showSkills: parsed.data.showSkills,
          userId: user.id,
          websiteUrl: parsed.data.websiteUrl || null,
        },
        update: {
          allowConnectionRequests: parsed.data.allowConnectionRequests,
          allowMessagesFromConnections:
            parsed.data.allowMessagesFromConnections,
          allowMessagesFromMembers: parsed.data.allowMessagesFromMembers,
          biography: parsed.data.biography,
          headline: parsed.data.headline,
          isDiscoverable: parsed.data.isDiscoverable,
          location: parsed.data.location,
          profileCompleteness: profileCompleteness,
          profileImageUrl: parsed.data.profileImageUrl || null,
          showLocation: parsed.data.showLocation,
          showSkills: parsed.data.showSkills,
          websiteUrl: parsed.data.websiteUrl || null,
        },
        where: { userId: user.id },
      });

      const profile = await tx.profile.findUnique({
        where: { userId: user.id },
      });
      if (profile) {
        await tx.profileSkill.deleteMany({
          where: { profileId: profile.id },
        });

        for (const skill of skillList) {
          await tx.profileSkill.create({
            data: { name: skill, profileId: profile.id },
          });
        }
      }
    });
  } catch (error) {
    console.error("Profile edit error:", error);
    redirect("/app/profile/edit?error=server-error");
  }

  await writeAuditLog({
    action: "profile.update",
    actorId: user.id,
    entityId: user.id,
    entityType: "profile",
  });
  revalidatePath("/app/profile");
  revalidatePath("/app/profile/edit");
  revalidatePath("/app/people");
  revalidatePath(`/u/${user.username}`);
  redirect("/app/profile/edit?success=true");
}
