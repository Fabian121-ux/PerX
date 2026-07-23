import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ProfileImageUploader } from "@/components/profile/profile-image-uploader";
import { updateProfileAction } from "@/features/profiles/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileForEdit } from "@/lib/data/profiles";
import { getServerEnv } from "@/lib/env";
import { isProfileImageStorageConfigured } from "@/lib/uploads/profile-image";

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "check-fields": "Please check your inputs and try again.",
  "server-error": "An unexpected server error occurred.",
};

export default async function ProfileEditPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const error = params.error
    ? errors[params.error] || "An unexpected error occurred."
    : null;
  const success =
    params.success === "true" ? "Profile updated successfully." : null;

  const user = await getCurrentUser();
  const profile = user ? await getProfileForEdit(user.id) : null;
  const env = getServerEnv();
  const storageEnabled = isProfileImageStorageConfigured();

  return (
    <AppSection
      description="Keep your profile accurate. Reviews and trust signals depend on account-level identity."
      title="Edit profile"
    >
      <Card>
        <form action={updateProfileAction} className="grid gap-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

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
          <ProfileImageUploader
            initialImageUrl={profile?.profileImageUrl}
            maxBytes={env.UPLOAD_MAX_BYTES}
            name={profile?.name ?? user?.name ?? "PerX member"}
            storageEnabled={storageEnabled}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website or portfolio">
              <Input
                defaultValue={profile?.websiteUrl}
                name="websiteUrl"
                placeholder="https://example.com"
                type="url"
              />
            </Field>
          </div>
          <Field label="Biography">
            <Textarea
              defaultValue={profile?.biography}
              name="biography"
              placeholder="Add your biography."
              required
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
          <Field hint="Comma-separated skills." label="Skills">
            <Input
              defaultValue={profile?.skills}
              name="skills"
              placeholder="Next.js, Prisma, Security"
            />
          </Field>
          <div className="grid gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
            <h2 className="text-base font-bold text-[color:var(--px-text)]">
              Profile privacy
            </h2>
            <CheckboxRow
              defaultChecked={profile?.isDiscoverable ?? true}
              label="Show my profile in people discovery"
              name="isDiscoverable"
            />
            <CheckboxRow
              defaultChecked={profile?.showLocation ?? true}
              label="Show my location on public profile and people cards"
              name="showLocation"
            />
            <CheckboxRow
              defaultChecked={profile?.showSkills ?? true}
              label="Show my skills on public profile and people cards"
              name="showSkills"
            />
            <CheckboxRow
              defaultChecked={profile?.allowConnectionRequests ?? true}
              label="Allow connection requests"
              name="allowConnectionRequests"
            />
            <CheckboxRow
              defaultChecked={profile?.allowMessagesFromConnections ?? true}
              label="Allow messages from accepted connections"
              name="allowMessagesFromConnections"
            />
            <CheckboxRow
              defaultChecked={profile?.allowMessagesFromMembers ?? false}
              label="Allow message requests from approved PerX members"
              name="allowMessagesFromMembers"
            />
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </Card>
    </AppSection>
  );
}

function CheckboxRow({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3 text-sm font-semibold text-[color:var(--px-text)]">
      <input name={name} type="hidden" value="off" />
      <input
        className="mt-0.5 size-4 accent-[color:var(--px-primary)]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}
