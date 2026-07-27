import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { ShieldCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calculateTrustSummary, trustBadgeClassName } from "@/lib/trust/engine";

export default async function TrustDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const trustSignals = await getPrisma().trustSignal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  const reviews = await getPrisma().review.findMany({
    where: { subjectId: user.id, visibility: "PUBLIC" },
    include: { author: true },
    orderBy: { createdAt: "desc" }
  });

  const trust = calculateTrustSummary({
    averageRating: user.profile?.averageRating ?? 0,
    completedDeals: user.profile?.completedDeals ?? 0,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    profileCompleteness: user.profile?.profileCompleteness ?? 0,
    verificationStatus: user.verificationStatus,
  });

  return (
    <AppSection
      title="Trust Dashboard"
      description="Your reputation is built on successful agreements, verified information, and community feedback."
    >
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex items-center gap-5 border-[color:var(--px-primary)]/20 bg-[color:var(--px-primary)]/5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary)] text-white">
            <ShieldCheck size={32} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--px-primary)] uppercase tracking-wide">Trust level</p>
            <h2 className="text-3xl font-black text-[color:var(--px-text)]">{trust.label}</h2>
            <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
              {trust.description}
            </p>
          </div>
        </Card>
        
        <Card className="flex flex-col justify-center gap-1">
          <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">Verified Signals</p>
          <p className="text-2xl font-black text-[color:var(--px-text)]">{trustSignals.length}</p>
        </Card>

        <Card className="flex flex-col justify-center gap-1">
          <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">Public Reviews</p>
          <p className="text-2xl font-black text-[color:var(--px-text)]">{reviews.length}</p>
        </Card>
      </div>

      <Card className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[color:var(--px-text)]">
              Public trust summary
            </h3>
            <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
              PerX uses broad trust levels during beta. Numeric scores are not
              shown until enough verified evidence exists and the methodology is
              approved.
            </p>
          </div>
          <Badge className={trustBadgeClassName(trust.level)}>
            {trust.shortLabel}
          </Badge>
        </div>
        <div className="mt-4 grid gap-2">
          {trust.evidence.length ? (
            trust.evidence.map((item) => (
              <div
                className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--px-text-muted)]"
                key={item}
              >
                {item}
              </div>
            ))
          ) : (
            <p className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] px-3 py-2 text-sm text-[color:var(--px-text-muted)]">
              Not enough verified activity yet.
            </p>
          )}
        </div>
        <p className="mt-4 text-xs text-[color:var(--px-text-muted)]">
          Calculation version: {trust.calculationVersion}
        </p>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-lg font-bold text-[color:var(--px-text)]">Trust Signals</h3>
          {trustSignals.length > 0 ? (
            <div className="grid gap-4">
              {trustSignals.map(signal => (
                <Card key={signal.id} className="flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-[color:var(--px-text)]">{signal.label}</h4>
                    <Badge className="bg-green-50 text-green-800">+{signal.value}</Badge>
                  </div>
                  <p className="text-sm text-[color:var(--px-text-muted)]">{signal.reason}</p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No trust signals" body="Complete your profile and identity verification to earn your first trust signals." />
          )}
        </div>

        <div>
          <h3 className="mb-4 text-lg font-bold text-[color:var(--px-text)]">Recent Reviews</h3>
          {reviews.length > 0 ? (
            <div className="grid gap-4">
              {reviews.map(review => (
                <Card key={review.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--px-surface-soft)] font-bold text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)]">
                        {review.author.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--px-text)]">{review.author.name}</p>
                        <p className="text-[10px] text-[color:var(--px-text-muted)]">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[color:var(--px-gold)]">
                      <Star size={14} className="fill-current" />
                      <span className="text-sm font-bold text-[color:var(--px-text)]">{review.rating}</span>
                    </div>
                  </div>
                  <h4 className="font-semibold text-[color:var(--px-text)]">{review.title}</h4>
                  <p className="text-sm text-[color:var(--px-text-muted)]">{review.body}</p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No reviews yet" body="Complete agreements successfully to earn community reviews." />
          )}
        </div>
      </div>
    </AppSection>
  );
}
