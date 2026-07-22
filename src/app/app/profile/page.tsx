import { UserRound, MapPin, Calendar, CheckCircle2, ShieldCheck } from "lucide-react";
import { AppSection } from "@/components/app-section";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";

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

  return (
    <AppSection
      title="Your Profile"
      description="Manage your public identity and account settings."
    >
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="h-32 bg-[color:var(--px-primary-soft)]" />
            <div className="px-6 pb-6">
              <div className="relative -mt-16 mb-4 flex justify-between">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[color:var(--px-surface)] bg-[color:var(--px-muted)]">
                  {user.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.imageUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={48} className="text-[color:var(--px-text-muted)]" />
                  )}
                </div>
                <div className="mt-16 flex gap-2">
                  <ButtonLink variant="outline" href="/app/profile/edit">Edit profile</ButtonLink>
                  <ButtonLink href="/app/settings">Account settings</ButtonLink>
                </div>
              </div>
              
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                {user.verificationStatus === "VERIFIED" && (
                  <CheckCircle2 size={20} className="text-blue-500" aria-label="Verified User" />
                )}
                {user.accountClassification === "INTERNAL_ADMIN" && (
                  <Badge className="bg-[color:var(--px-error)] text-white">Admin</Badge>
                )}
              </div>
              <p className="mb-4 text-lg text-[color:var(--px-text-muted)]">@{user.username}</p>
              
              <p className="mb-6 font-medium">{user.profile.headline}</p>
              
              <div className="flex flex-wrap gap-4 text-sm text-[color:var(--px-text-muted)]">
                {user.profile.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={16} />
                    <span>{user.profile.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} />
                  <span>Joined {joinDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-[color:var(--px-gold)]" />
                  <span>Trust Score: {user.profile.trustScore}</span>
                </div>
              </div>
            </div>
          </Card>
          
          {user.profile.biography && (
            <Card>
              <h2 className="mb-4 text-lg font-bold">About</h2>
              <p className="whitespace-pre-wrap text-[color:var(--px-text)]">{user.profile.biography}</p>
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
