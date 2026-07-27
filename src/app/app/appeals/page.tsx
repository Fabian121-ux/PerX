import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { submitAppealAction } from "@/features/appeals/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export default async function AppealsPage({
  searchParams,
}: {
  searchParams: Promise<{ alreadySubmitted?: string; error?: string; submitted?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const enforcementActions = await getPrisma().enforcementAction.findMany({
    include: {
      appeals: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    where: {
      appealAllowed: true,
      targetUserId: user.id,
    },
  });

  return (
    <AppSection
      actions={<ButtonLink href="/app/settings" variant="secondary">Back to settings</ButtonLink>}
      description="Submit appeals for eligible account enforcement actions. Internal moderation notes remain private."
      title="Appeals"
    >
      <div className="grid gap-4">
        {params.submitted ? (
          <Card className="border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
            Your appeal was submitted.
          </Card>
        ) : null}
        {params.alreadySubmitted ? (
          <Card className="border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900">
            An appeal for that action is already open.
          </Card>
        ) : null}
        {params.error ? (
          <Card className="border-red-200 bg-red-50 text-sm font-semibold text-red-700">
            The appeal could not be submitted. Check the details and try again.
          </Card>
        ) : null}

        {enforcementActions.length ? (
          enforcementActions.map((action) => {
            const latestAppeal = action.appeals[0];
            return (
              <Card className="grid gap-4" key={action.id}>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[color:var(--px-primary)]">
                    {action.type.replaceAll("_", " ")}
                  </p>
                  <h2 className="mt-1 font-black text-[color:var(--px-text)]">
                    {action.userFacingExplanation}
                  </h2>
                  <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
                    Applied {action.createdAt.toLocaleString()}
                    {action.expiresAt ? ` · Expires ${action.expiresAt.toLocaleString()}` : ""}
                  </p>
                </div>
                {latestAppeal ? (
                  <p className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3 text-sm font-semibold text-[color:var(--px-text-muted)]">
                    Latest appeal status: {latestAppeal.status.replaceAll("_", " ")}
                  </p>
                ) : (
                  <form action={submitAppealAction} className="grid gap-3">
                    <input name="enforcementActionId" type="hidden" value={action.id} />
                    <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                      Appeal details
                      <Textarea
                        maxLength={1500}
                        minLength={20}
                        name="body"
                        placeholder="Explain why this action should be reviewed or changed."
                        required
                      />
                    </label>
                    <Button className="w-full sm:w-auto" type="submit">
                      Submit appeal
                    </Button>
                  </form>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState
            body="Eligible enforcement actions will appear here if an appeal is available."
            title="No appealable actions"
          />
        )}
      </div>
    </AppSection>
  );
}
