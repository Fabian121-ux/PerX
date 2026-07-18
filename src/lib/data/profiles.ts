import { getPrisma } from "@/lib/db/prisma";
import { isProductionMockModeError } from "@/lib/env";
import { logServerDataError } from "@/lib/logging/runtime";
import { getPerXDataProvider } from "./provider";

export async function getPublicProfileResult(username: string) {
  try {
    const provider = await getPerXDataProvider();
    const profile = await provider.profiles.getPublicProfile(username);
    return { profile, unavailable: false };
  } catch (error) {
    if (isProductionMockModeError(error)) throw error;

    logServerDataError({
      error,
      operation: "public profile",
      route: `/u/${username}`,
    });
    return { profile: null, unavailable: true };
  }
}

export async function getPublicProfile(username: string) {
  const result = await getPublicProfileResult(username);
  return result.profile;
}

export async function getProfileForEdit(userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        include: { skills: true },
      },
    },
  });

  if (!user || !user.profile) return null;

  return {
    name: user.name,
    username: user.username,
    headline: user.profile.headline,
    biography: user.profile.biography,
    location: user.profile.location,
    profileImageUrl: user.profile.profileImageUrl ?? "",
    skills: user.profile.skills.map((s) => s.name).join(", "),
    websiteUrl: user.profile.websiteUrl ?? "",
  };
}
