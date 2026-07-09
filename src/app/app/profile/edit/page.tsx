import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { updateProfileAction } from "@/features/profiles/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileForEdit } from "@/lib/data/profiles";

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "check-fields": "Please check your inputs and try again.",
  "server-error": "An unexpected server error occurred.",
};

export default async function ProfileEditPage({ searchParams }: { searchParams: Promise<{ error?: string, success?: string }> }) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] || "An unexpected error occurred." : null;
  const success = params.success === "true" ? "Profile updated successfully." : null;

  const user = await getCurrentUser();
  const profile = user ? await getProfileForEdit(user.id) : null;

  return (
    <AppSection description="Keep your profile accurate. Reviews and trust signals depend on account-level identity." title="Edit profile">
      <Card>
        <form action={updateProfileAction} className="grid gap-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input defaultValue={profile?.name} disabled />
            </Field>
            <Field label="Username">
              <Input defaultValue={profile?.username} disabled />
            </Field>
          </div>

          <Field label="Professional headline">
            <Input defaultValue={profile?.headline} name="headline" required />
          </Field>
          <Field label="Biography">
            <Textarea defaultValue={profile?.biography} name="biography" placeholder="Add your biography." required />
          </Field>
          <Field label="Location">
            <Input defaultValue={profile?.location} name="location" placeholder="City, country or remote" required />
          </Field>
          <Field hint="Comma-separated skills." label="Skills">
            <Input defaultValue={profile?.skills} name="skills" placeholder="Next.js, Prisma, Security" />
          </Field>
          <Button type="submit">Save changes</Button>
        </form>
      </Card>
    </AppSection>
  );
}
