import { UserRound, MapPin, Calendar, CheckCircle2, ShieldCheck } from "lucide-react";
import { AppSection } from "@/components/app-section";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { calculateTrustSummary, trustBadgeClassName } from "@/lib/trust/engine";

export default async function ProfilePage() {
  const user = await requireUser();

  if (!user.profile) {
    return (
      <AppSection
        title="Your Profile"
        description="Manage your identity on PerX."
      >
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 rounded-full bg-[color:var(--px-primary-soft)] p-4 text-[color:var(--px-primary)]">
            <UserRound size={48} />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Complete your profile</h2>
          <p className="mb-6 max-w-md text-[color:var(--px-text-muted)]">
            You haven&apos;t completed your profile setup yet. A complete profile improves discovery, trust, and your ability to connect with others on PerX.
          </p>
          <ButtonLink href="/app/profile/setup">Complete profile</ButtonLink>
        </Card>
      </AppSection>
    );
  }

  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Unknown';
  const trust = calculateTrustSummary({
    averageRating: user.profile.averageRating ?? 0,
    completedDeals: user.profile.completedDeals ?? 0,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    profileCompleteness: user.profile.profileCompleteness,
    verificationStatus: user.verificationStatus,
  });

  return (
    <AppSection
      title="Your Profile"
      description="Manage your public identity and account settings."
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="h-24 bg-[color:var(--px-primary-soft)] sm:h-32" />
            <div className="px-4 pb-6 sm:px-6">
              <div className="relative -mt-12 mb-4 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[color:var(--px-surface)] bg-[color:var(--px-muted)] sm:h-32 sm:w-32">
                  {user.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.imageUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={48} className="text-[color:var(--px-text-muted)]" />
                  )}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <ButtonLink className="w-full sm:w-auto" variant="outline" href="/app/profile/edit">Edit profile</ButtonLink>
                  <ButtonLink className="w-full sm:w-auto" href="/app/settings">Account settings</ButtonLink>
                </div>
              </div>
              
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-2xl font-bold text-[color:var(--px-text)]">
                  {user.name}
                </h1>
                {user.verificationStatus === "VERIFIED" && (
                  <CheckCircle2 size={20} className="text-blue-500" aria-label="Verified User" />
                )}
                {user.accountClassification === "INTERNAL_ADMIN" && (
                  <Badge className="bg-[color:var(--px-error)] text-white">Admin</Badge>
                )}
              </div>
              <p className="mb-4 break-all text-lg text-[color:var(--px-text-muted)]">@{user.username}</p>
              
              <p className="mb-6 font-medium">{user.profile.headline}</p>
              
              <div className="flex flex-wrap gap-3 text-sm text-[color:var(--px-text-muted)]">
                {user.profile.location && (
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5">
                    <MapPin size={16} />
                    <span className="truncate">{user.profile.location}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5">
                  <Calendar size={16} />
                  <span>Joined {joinDate}</span>
                </div>
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${trustBadgeClassName(trust.level)}`}>
                  <ShieldCheck size={16} className="text-[color:var(--px-gold)]" />
                  <span>{trust.label}</span>
                </div>
              </div>
            </div>
          </Card>
          
          {user.profile.biography && (
            <Card>
              <h2 className="mb-4 text-lg font-bold">About</h2>
              <p className="whitespace-pre-wrap break-words text-[color:var(--px-text)]">{user.profile.biography}</p>
            </Card>
          )}
        </div>
        
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-lg font-bold">Details</h2>
            <div className="grid gap-4 text-sm">
              <div>
                <span className="block text-[color:var(--px-text-muted)]">Email</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div>
                <span className="block text-[color:var(--px-text-muted)]">Account Classification</span>
                <span className="font-medium">{user.accountClassification?.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="block text-[color:var(--px-text-muted)]">Roles</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.roles.map(role => (
                    <Badge key={role} className="bg-white">{role}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[color:var(--px-text-muted)]">Profile Completeness</span>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--px-surface-soft)]">
                  <div 
                    className="h-full bg-[color:var(--px-primary)]" 
                    style={{ width: `${user.profile.profileCompleteness}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppSection>
  );
}
