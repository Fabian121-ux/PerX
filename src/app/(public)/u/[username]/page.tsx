import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/standard-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPublicProfile } from "@/lib/data/profiles";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const normalized =
    "profile" in profile
      ? {
          biography: profile.profile?.biography ?? "This member has not completed a biography.",
          headline: profile.profile?.headline ?? "perX member",
          name: profile.name,
          roles: profile.roles.map((entry) => entry.role.label),
          trustScore: profile.profile?.trustScore ?? 0,
        }
      : {
          biography: profile.biography,
          headline: profile.headline,
          name: profile.name,
          roles: profile.roles,
          trustScore: profile.trustScore,
        };

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Public profile</p>
              <h1 className="mt-3 text-4xl font-bold text-slate-950">{normalized.name}</h1>
              <p className="mt-2 text-lg text-slate-600">{normalized.headline}</p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{normalized.biography}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
              <p className="text-sm font-medium text-emerald-800">Trust score</p>
              <p className="mt-1 text-4xl font-black text-emerald-900">{normalized.trustScore}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {normalized.roles.map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
          </div>
        </Card>
      </main>
    </PublicPageShell>
  );
}
