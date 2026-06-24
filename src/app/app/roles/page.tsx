import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateRolesAction } from "@/features/roles/actions";
import { getCurrentUser } from "@/lib/auth/session";

const roleOptions = [
  ["FREELANCER", "Freelancer"],
  ["CLIENT", "Client"],
  ["FOUNDER", "Founder"],
  ["INVESTOR", "Investor"],
  ["PROPERTY_OWNER", "Property Owner"],
];

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
    </AppSection>
  );
}
