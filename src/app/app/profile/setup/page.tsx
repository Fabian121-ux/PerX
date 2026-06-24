import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { updateProfileAction } from "@/features/profiles/actions";

export default function ProfileSetupPage() {
  return (
    <AppSection description="A complete profile improves discovery, trust, and proposal conversion." title="Profile setup">
      <Card>
        <form action={updateProfileAction} className="grid gap-4">
          <Field label="Professional headline">
            <Input name="headline" placeholder="Full-stack engineer for secure marketplaces" required />
          </Field>
          <Field label="Biography">
            <Textarea name="biography" placeholder="Describe your experience, how you work, and what makes you trustworthy." required />
          </Field>
          <Field label="Location">
            <Input name="location" placeholder="City, country or remote" required />
          </Field>
          <Field hint="Comma-separated skills." label="Skills">
            <Input name="skills" placeholder="Next.js, Prisma, Security" />
          </Field>
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </AppSection>
  );
}
