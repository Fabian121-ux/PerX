import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { previewUser, previewTrustBreakdown, previewReviews } from "@/lib/data/preview";
import { ShieldCheck, MapPin, Star } from "lucide-react";

export default function PreviewProfilePage() {
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
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:min-w-[130px] self-start">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Trust score</p>
                <p className="mt-1 text-5xl font-black text-emerald-950">{previewUser.trustScore}</p>
                <p className="mt-1.5 text-xs text-emerald-800 font-semibold">{previewUser.completedDeals} deals completed</p>
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
          <Card>
            <h2 className="text-lg font-bold text-slate-950 mb-4 flex items-center gap-2">
              <ShieldCheck className="text-emerald-700" size={20} />
              Trust Score Breakdown
            </h2>
            <div className="grid gap-5">
              {previewTrustBreakdown.map((item) => (
                <div key={item.key} className="grid gap-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-900">{item.label}</span>
                    <span className="text-[color:var(--px-primary)]">{item.value} / 100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 rounded-full transition-all" 
                      style={{ width: `${item.value}%` }} 
                    />
                  </div>
                  <p className="text-[11px] text-[color:var(--px-text-muted)] mt-0.5">{item.reason}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppSection>
  );
}
