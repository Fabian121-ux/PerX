import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { demoProfiles } from "@/lib/data/demo";

export async function getPublicProfile(username: string) {
  if (!hasDatabaseUrl()) {
    return demoProfiles.find((profile) => profile.username === username) ?? null;
  }

  try {
    return await getPrisma().user.findUnique({
      include: {
        profile: { include: { portfolio: true, skills: true, workHistory: true } },
        reviewsReceived: { take: 5, orderBy: { createdAt: "desc" } },
        roles: { include: { role: true } },
      },
      where: { username },
    });
  } catch {
    return demoProfiles.find((profile) => profile.username === username) ?? null;
  }
}
