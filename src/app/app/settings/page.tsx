import { AppSection } from "@/components/app-section";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function SettingsPage() {
  return (
    <AppSection
      description="Manage account preferences and security controls."
      title="Account settings"
    >
      <Card>
        <h2 className="font-semibold text-[color:var(--px-text)]">Security</h2>
        <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
          Review sessions, password policy, and account protection controls.
        </p>
        <ButtonLink
          className="mt-4"
          href="/app/settings/security"
          variant="secondary"
        >
          Security settings
        </ButtonLink>
      </Card>
      <Card>
        <h2 className="font-semibold text-[color:var(--px-text)]">Blocked users</h2>
        <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
          Review people you have blocked and restore access when appropriate.
        </p>
        <ButtonLink
          className="mt-4"
          href="/app/settings/blocked"
          variant="secondary"
        >
          Manage blocked users
        </ButtonLink>
      </Card>
      <Card>
        <h2 className="font-semibold text-[color:var(--px-text)]">Appeals</h2>
        <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
          Review eligible account enforcement actions and submit an appeal.
        </p>
        <ButtonLink
          className="mt-4"
          href="/app/appeals"
          variant="secondary"
        >
          View appeals
        </ButtonLink>
      </Card>
    </AppSection>
  );
}
