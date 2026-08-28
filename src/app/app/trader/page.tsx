import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";
import { TraderApplicationForm } from "@/components/trader/trader-application-form";
import { requireUser } from "@/lib/auth/session";
import { opportunityCategoryOptions } from "@/lib/options";
import { getOwnTraderApplication, isTrader } from "@/lib/trader/access";

export const dynamic = "force-dynamic";

export default async function TraderPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const application = await getOwnTraderApplication(user.id).catch(() => null);
  const alreadyTrader = isTrader(user.roles);

  const categories = opportunityCategoryOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));

  return (
    <main className="mx-auto grid w-full max-w-xl gap-4 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
          Trader access
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--px-text)]">
          {alreadyTrader ? "You can create on PerX" : "Become a Trader"}
        </h1>
      </div>

      {alreadyTrader ? (
        <Card className="grid gap-4">
          <FormNotice tone="success">
            Trading access is active on this account.
          </FormNotice>
          <ButtonLink href="/app/opportunities/new">
            Create your first opportunity
          </ButtonLink>
        </Card>
      ) : application?.status === "PENDING_REVIEW" ? (
        <Card className="grid gap-3">
          <FormNotice tone="info">
            Under review
            {application.submittedAt
              ? ` · submitted ${application.submittedAt.toLocaleDateString()}`
              : ""}
          </FormNotice>
          <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">
            We&apos;ll notify you when a decision has been made. Nothing else on
            your account changes in the meantime.
          </p>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">
                What you want to trade
              </dt>
              <dd className="mt-1 text-[color:var(--px-text)]">
                {application.headline}
              </dd>
            </div>
          </dl>
        </Card>
      ) : application?.status === "REJECTED" ||
        application?.status === "SUSPENDED" ? (
        <Card className="grid gap-3">
          <FormNotice tone="warning">
            {application.reviewerNote ??
              "Trading access is not available on this account."}
          </FormNotice>
          <ButtonLink href="/app/support" variant="secondary">
            Contact support
          </ButtonLink>
        </Card>
      ) : (
        <Card className="grid gap-4">
          {params.status === "submitted" ? (
            <FormNotice tone="success">
              Application received. We&apos;ll let you know when it has been
              reviewed.
            </FormNotice>
          ) : null}

          {application?.status === "NEEDS_CHANGES" ? (
            <FormNotice tone="warning">
              {application.reviewerNote ??
                "A reviewer asked for a little more detail."}
            </FormNotice>
          ) : null}

          <TraderApplicationForm
            categories={categories}
            defaults={
              application
                ? {
                    experience: undefined,
                    headline: application.headline,
                    tradeCategory: application.tradeCategory,
                  }
                : undefined
            }
          />
        </Card>
      )}
    </main>
  );
}
