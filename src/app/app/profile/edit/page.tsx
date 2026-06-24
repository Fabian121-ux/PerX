import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { updateProfileAction } from "@/features/profiles/actions";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProfileEditPage() {
  const user = await getCurrentUser();

  return (
    <AppSection description="Keep your profile accurate. Reviews and trust signals depend on account-level identity." title="Edit profile">
      <Card>
        <form action={updateProfileAction} className="grid gap-4">
          <Field label="Professional headline">
            <Input defaultValue={user?.profile?.headline} name="headline" required />
          </Field>
          <Field label="Biography">
            <Textarea name="biography" placeholder="Add your biography." required />
          </Field>
          <Field label="Location">
            <Input name="location" placeholder="City, country or remote" required />
          </Field>
          <Field hint="Comma-separated skills." label="Skills">
            <Input name="skills" placeholder="Next.js, Prisma, Security" />
          </Field>
          <Button type="submit">Save changes</Button>
        </form>
      </Card>
    </AppSection>
  );
}
