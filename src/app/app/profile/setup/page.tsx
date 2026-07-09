import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { setupProfileAction } from "@/features/profiles/setup-action";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileForEdit } from "@/lib/data/profiles";

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "check-fields": "Please check your inputs and try again.",
  "username-taken": "This username is already taken. Please choose another.",
  "server-error": "An unexpected server error occurred.",
};

export default async function ProfileSetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] || "An unexpected error occurred." : null;
  const user = await getCurrentUser();
  const profile = user ? await getProfileForEdit(user.id) : null;
  return (
    <AppSection description="A complete profile improves discovery, trust, and proposal conversion." title="Profile setup">
      <Card>
        <form action={setupProfileAction} className="grid gap-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input defaultValue={profile?.name} name="name" required />
            </Field>
            <Field label="Username">
              <Input defaultValue={profile?.username} name="username" required pattern="[a-zA-Z0-9_-]+" title="Only letters, numbers, underscores, and hyphens" />
            </Field>
          </div>

          <Field label="Professional headline">
            <Input defaultValue={profile?.headline} name="headline" placeholder="Full-stack engineer for secure marketplaces" required />
          </Field>
          <Field label="Biography">
            <Textarea defaultValue={profile?.biography} name="biography" placeholder="Describe your experience, how you work, and what makes you trustworthy." required />
          </Field>
          <Field label="Location">
            <Input defaultValue={profile?.location} name="location" placeholder="City, country or remote" required />
          </Field>
          <Field hint="Comma-separated skills." label="Skills">
            <Input defaultValue={profile?.skills} name="skills" placeholder="Next.js, Prisma, Security" />
          </Field>
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </AppSection>
  );
}
