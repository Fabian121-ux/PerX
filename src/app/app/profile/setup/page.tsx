import {
  BriefcaseBusiness,
  Building2,
  Handshake,
  Search,
  ShoppingBag,
  UserRoundPlus,
} from "lucide-react";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { setupProfileAction } from "@/features/profiles/setup-action";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileForEdit } from "@/lib/data/profiles";

const activityChoices = [
  {
    href: "/app/discover?type=JOB",
    icon: Search,
    label: "Find work",
  },
  {
    href: "/app/profile/edit",
    icon: UserRoundPlus,
    label: "Offer a skill",
  },
  {
    href: "/app/opportunities/new",
    icon: BriefcaseBusiness,
    label: "Hire someone",
  },
  {
    href: "/app/discover?type=BUSINESS",
    icon: Building2,
    label: "Register a business",
  },
  {
    href: "/app/discover?type=PARTNERSHIP",
    icon: Handshake,
    label: "Find a partner",
  },
  {
    href: "/app/opportunities/new",
    icon: BriefcaseBusiness,
    label: "Post an opportunity",
  },
  {
    href: "/app/discover?type=BUSINESS",
    icon: Building2,
    label: "Explore businesses",
  },
  {
    href: "/app/discover?type=MARKETPLACE",
    icon: ShoppingBag,
    label: "Buy or sell goods",
  },
];

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "check-fields": "Please check your inputs and try again.",
  "username-taken": "This username is already taken. Please choose another.",
  "server-error": "An unexpected server error occurred.",
};

export default async function ProfileSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error
    ? errors[params.error] || "An unexpected error occurred."
    : null;
  const user = await getCurrentUser();
  const profile = user ? await getProfileForEdit(user.id) : null;
  return (
    <AppSection
      description="A complete profile improves discovery, trust, and proposal conversion."
      title="Profile setup"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <form action={setupProfileAction} className="grid gap-4">
            {error ? (
              <div className="rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input defaultValue={profile?.name} name="name" required />
              </Field>
              <Field label="Username">
                <Input
                  defaultValue={profile?.username}
                  name="username"
                  required
                  pattern="[a-zA-Z0-9_-]+"
                  title="Only letters, numbers, underscores, and hyphens"
                />
              </Field>
            </div>

            <Field label="Profile photograph URL">
              <Input
                defaultValue={profile?.profileImageUrl}
                name="profileImageUrl"
                placeholder="https://example.com/profile-photo.jpg"
                type="url"
              />
            </Field>
            <Field label="Location">
              <Input
                defaultValue={profile?.location}
                name="location"
                placeholder="City, country or remote"
                required
              />
            </Field>
            <Field label="Professional headline">
              <Input
                defaultValue={profile?.headline}
                name="headline"
                placeholder="Full-stack engineer for secure marketplaces"
                required
              />
            </Field>
            <Field label="Website or portfolio">
              <Input
                defaultValue={profile?.websiteUrl}
                name="websiteUrl"
                placeholder="https://example.com"
                type="url"
              />
            </Field>
            <Field label="Short introduction">
              <Textarea
                defaultValue={profile?.biography}
                name="biography"
                placeholder="Describe your experience, how you work, and what makes you trustworthy."
                required
              />
            </Field>
            <Field hint="Comma-separated skills." label="Skills">
              <Input
                defaultValue={profile?.skills}
                name="skills"
                placeholder="Next.js, Prisma, Security"
              />
            </Field>
            <Button type="submit">Save profile</Button>
          </form>
        </Card>

        <Card className="self-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[color:var(--px-text)]">
                What would you like to do?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                These are navigation choices, not permanent identity labels.
              </p>
            </div>
            <Badge>Optional</Badge>
          </div>
          <div className="mt-5 grid gap-2">
            {activityChoices.map((choice) => (
              <a
                className="group flex min-h-12 items-center gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 py-2 text-sm font-bold text-[color:var(--px-text)] transition hover:border-[color:var(--px-primary)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={choice.href}
                key={choice.label}
              >
                <span className="grid h-9 w-9 place-items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
                  <choice.icon aria-hidden size={17} />
                </span>
                {choice.label}
              </a>
            ))}
          </div>
        </Card>
      </div>
    </AppSection>
  );
}
