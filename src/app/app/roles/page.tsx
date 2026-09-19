import Link from "next/link";

import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateRolesAction } from "@/features/roles/actions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  roleLabels,
  selfAssignableRoles,
} from "@/lib/permissions/capabilities";

/*
 * Rendered from `selfAssignableRoles` rather than a local list.
 *
 * The page previously hardcoded five options while the server accepted two, so
 * Client, Founder and Property Owner were silently filtered - and ticking only
 * Client produced "choose a role" after the user had chosen one. Deriving the
 * options means adding a role to the allow-list changes this page with no
 * second edit, which is the only way the two stay in agreement.
 */
const roleOptions = [...selfAssignableRoles].map(
  (role) => [role, roleLabels[role]] as const,
);

export default async function RolesPage() {
  const user = await getCurrentUser();

  return (
    <AppSection description="One account can hold several ecosystem roles. Capabilities are enforced server-side." title="Role management">
      <Card>
        <form action={updateRolesAction} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {roleOptions.map(([value, label]) => (
              <label className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-sm font-medium text-slate-700" key={value}>
                <input className="size-4 accent-emerald-600" defaultChecked={user?.roles.includes(value as never)} name="roles" type="checkbox" value={value} />
                {label}
              </label>
            ))}
          </div>
          <Button type="submit">Update roles</Button>
        </form>
      </Card>

      {/*
        Removing the three options without saying where publishing access comes
        from would replace a misleading control with a dead end.
      */}
      <Card>
        <h2 className="font-bold text-[color:var(--px-text)]">
          Posting and listing access
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
          Roles that let you publish opportunities are granted by a reviewer
          rather than chosen here. Apply through the trader application and
          we&apos;ll let you know when it has been reviewed.
        </p>
        <p className="mt-3 text-sm">
          <Link
            className="font-semibold text-[color:var(--px-primary)] hover:underline"
            href="/app/trader"
          >
            Open the trader application
          </Link>
        </p>
      </Card>
    </AppSection>
  );
}
