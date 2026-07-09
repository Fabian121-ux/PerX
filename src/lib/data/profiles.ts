import { getPrisma } from "@/lib/db/prisma";
import { getPerXDataProvider } from "./provider";

export async function getPublicProfile(username: string) {
  const provider = await getPerXDataProvider();
  return provider.profiles.getPublicProfile(username);
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
    skills: user.profile.skills.map((s) => s.name).join(", "),
  };
}
