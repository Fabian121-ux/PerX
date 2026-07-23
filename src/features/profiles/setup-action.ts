"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { requireUser } from "@/lib/auth/session";
import { profileSetupSchema } from "@/lib/validation/auth";

function checkboxValue(
  formData: FormData,
  name: string,
  defaultValue: boolean,
) {
  const values = formData.getAll(name).map(String);
  if (!values.length) return defaultValue;
  return values.includes("on");
}

export async function setupProfileAction(formData: FormData) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") redirect("/app?mock=true");
  if (!hasDatabaseUrl())
    redirect("/app/profile/setup?error=database-not-configured");

  const rawData = {
    name: String(formData.get("name") || ""),
    username: String(formData.get("username") || ""),
    headline: String(formData.get("headline") || ""),
    biography: String(formData.get("biography") || ""),
    location: String(formData.get("location") || ""),
    profileImageUrl: String(formData.get("profileImageUrl") || ""),
    skills: String(formData.get("skills") || ""),
    websiteUrl: String(formData.get("websiteUrl") || ""),
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
  };

  const parsed = profileSetupSchema.safeParse(rawData);
  if (!parsed.success) {
    redirect("/app/profile/setup?error=check-fields");
  }

  const {
    name,
    username,
    headline,
    biography,
    location,
    profileImageUrl,
    skills,
    websiteUrl,
    isDiscoverable,
    showLocation,
    showSkills,
    allowConnectionRequests,
    allowMessagesFromConnections,
    allowMessagesFromMembers,
  } = parsed.data;

  // Check if username is taken by another user
  const existingUsername = await getPrisma().user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUsername && existingUsername.id !== user.id) {
    redirect("/app/profile/setup?error=username-taken");
  }

  const skillList = skills
    ? skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const completeness =
    30 +
    (headline ? 10 : 0) +
    (biography.length > 50 ? 20 : 0) +
    (location ? 10 : 0) +
    (skillList.length > 0 ? 10 : 0);

  try {
    await getPrisma().$transaction(async (tx) => {
      // Update User
      await tx.user.update({
        where: { id: user.id },
        data: { imageUrl: profileImageUrl || null, name, username },
      });

      const profileData = {
        allowConnectionRequests,
        allowMessagesFromConnections,
        allowMessagesFromMembers,
        biography,
        headline,
        isDiscoverable,
        location,
        profileCompleteness: completeness,
        profileImageUrl: profileImageUrl || null,
        showLocation,
        showSkills,
        websiteUrl: websiteUrl || null,
      };

      // Update Profile
      await tx.profile.upsert({
        where: { userId: user.id },
        update: profileData,
        create: { userId: user.id, ...profileData },
      });

      const profile = await tx.profile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (profile) {
        await tx.profileSkill.deleteMany({ where: { profileId: profile.id } });
        for (const skill of skillList) {
          await tx.profileSkill.create({
            data: { name: skill, profileId: profile.id },
          });
        }
      }
    });
  } catch (error) {
    console.error("Profile setup error:", error);
    redirect("/app/profile/setup?error=server-error");
  }

  await writeAuditLog({
    actorId: user.id,
    action: "profile.setup",
    entityId: user.id,
    entityType: "profile",
  });

  revalidatePath("/app/profile");
  revalidatePath("/app/profile/setup");
  revalidatePath("/app/people");
  revalidatePath(`/u/${username}`);
  redirect("/app");
}
