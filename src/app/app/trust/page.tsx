import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calculateTrustSummary } from "@/lib/trust/engine";
import { TrustPresentationCard } from "@/components/trust/trust-presentation-card";
import { createTrustPresentation } from "@/lib/trust/presentation";
import { getTrustRecordEvidence } from "@/lib/trust/records";

export default async function TrustDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [trustSignals, reviews, recordEvidence] = await Promise.all([
    getPrisma().trustSignal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    getPrisma().review.findMany({
      where: { subjectId: user.id, visibility: "PUBLIC" },
      include: { author: true },
      orderBy: { createdAt: "desc" },
    }),
    getTrustRecordEvidence(user.id),
  ]);

  const trust = calculateTrustSummary({
    averageRating: recordEvidence.averageRating,
    completedDeals: recordEvidence.completedAgreements,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    profileCompleteness: user.profile?.profileCompleteness ?? 0,
    verificationStatus: user.verificationStatus,
  });
  const presentation = createTrustPresentation({
    averageRating: recordEvidence.averageRating,
    completedAgreements: recordEvidence.completedAgreements,
    emailVerified: Boolean(user.emailVerifiedAt),
    profileCompleteness: user.profile?.profileCompleteness ?? 0,
    publicReviewCount: recordEvidence.publicReviewCount,
    summary: trust,
    verificationStatus: user.verificationStatus,
  });

  return (
    <AppSection
      title="Trust Dashboard"
      description="Your reputation is built on successful agreements, verified information, and community feedback."
    >
      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <TrustPresentationCard presentation={presentation} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="flex flex-col justify-center gap-1">
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
              Additional recorded signals
            </p>
            <p className="text-2xl font-black text-[color:var(--px-text)]">
              {trustSignals.length}
            </p>
          </Card>
          <Card className="flex flex-col justify-center gap-1">
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
              Public reviews
            </p>
            <p className="text-2xl font-black text-[color:var(--px-text)]">
              {reviews.length}
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-lg font-bold text-[color:var(--px-text)]">Additional recorded signals</h3>
          {trustSignals.length > 0 ? (
            <div className="grid gap-4">
              {trustSignals.map(signal => (
                <Card key={signal.id} className="flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-[color:var(--px-text)]">{signal.label}</h4>
                    <Badge className="bg-green-50 text-green-800">Recorded</Badge>
                  </div>
                  <p className="text-sm text-[color:var(--px-text-muted)]">{signal.reason}</p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No additional trust records" body="No additional Trust Signal records are available for this account." />
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
