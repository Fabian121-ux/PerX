import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { previewUser, previewReviews } from "@/lib/data/preview";
import { MapPin, Star } from "lucide-react";
import {
  TrustLevelBadge,
  TrustPresentationCard,
} from "@/components/trust/trust-presentation-card";
import { calculateTrustSummary } from "@/lib/trust/engine";
import { createTrustPresentation } from "@/lib/trust/presentation";

export default function PreviewProfilePage() {
  const averageRating =
    previewReviews.reduce((total, review) => total + review.rating, 0) /
    previewReviews.length;
  const summary = calculateTrustSummary({
    averageRating,
    completedDeals: previewUser.completedDeals,
    emailVerifiedAt: "preview",
    profileCompleteness: 95,
    verificationStatus: "VERIFIED",
  });
  const presentation = createTrustPresentation({
    averageRating,
    completedAgreements: previewUser.completedDeals,
    emailVerified: true,
    profileCompleteness: 95,
    publicReviewCount: previewReviews.length,
    summary,
    verificationStatus: "VERIFIED",
  });

  return (
    <AppSection description="Completed professional profile, multiple ecosystem roles, and verified trust breakdown." title="Profile">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1.1fr]">
        <div className="grid gap-6">
          <Card>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Verified Member</p>
                <h1 className="mt-3 text-3xl font-bold text-slate-950">{previewUser.name}</h1>
                <p className="mt-2 text-md font-semibold text-slate-700">{previewUser.headline}</p>
                
                <div className="mt-4 flex items-center gap-2 text-xs text-[color:var(--px-text-muted)]">
                  <MapPin size={14} />
                  <span>{previewUser.location}</span>
                </div>
                
                <p className="mt-4 text-sm leading-6 text-slate-600">{previewUser.biography}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:min-w-[160px] self-start">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Preview evidence</p>
                <div className="mt-3 flex justify-center">
                  <TrustLevelBadge presentation={presentation} />
                </div>
                <p className="mt-2 text-xs text-emerald-800 font-semibold">{previewUser.completedDeals} fictional completed agreements</p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wide">Ecosystem Roles</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {previewUser.roles.map((role) => (
                  <Badge key={role} className="bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)] border-[color:var(--px-primary-soft)]">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wide">Core Skills</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {previewUser.skills.map((skill) => (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-slate-950">Fictional Reviews</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {previewReviews.map((review) => (
                <div key={review.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="font-bold text-slate-950 text-sm">{review.authorName}</h4>
                      <p className="text-xs text-[color:var(--px-text-muted)]">{review.authorHeadline}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="fill-amber-400 text-amber-400" size={14} />
                      ))}
                      <span className="text-xs text-[color:var(--px-text-muted)] font-medium ml-1">{review.createdAt}</span>
                    </div>
                  </div>
                  <h5 className="mt-3 font-semibold text-slate-900 text-sm">{review.title}</h5>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">{review.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <TrustPresentationCard presentation={presentation} />
        </div>
      </div>
    </AppSection>
  );
}
