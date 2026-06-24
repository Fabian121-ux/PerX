import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";

export default async function SecuritySettingsPage() {

  return (
    <AppSection description="Session cookies are HTTP-only and server-side session validation is required for private routes." title="Security settings">
      <Card>
        <h2 className="font-semibold text-[color:var(--px-text)]">Active protection</h2>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
          <li>Secure session cookie configuration.</li>
          <li>Server-side capability checks.</li>
          <li>Object-level access checks for conversations and deals.</li>
          <li>Audit logging for protected mutations.</li>
        </ul>
      </Card>
    </AppSection>
  );
}
