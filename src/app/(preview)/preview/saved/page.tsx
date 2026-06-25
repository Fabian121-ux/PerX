"use client";

import { useState } from "react";
import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { previewSavedOpportunities } from "@/lib/data/preview";
import { formatBudgetRange } from "@/lib/money";
import { Bookmark, MapPin, ShieldCheck } from "lucide-react";

export default function PreviewSavedPage() {
  const [savedList, setSavedList] = useState(previewSavedOpportunities);
  const [selectedOpp, setSelectedOpp] = useState<typeof previewSavedOpportunities[0] | null>(null);

  const removeSaved = (id: string) => {
    setSavedList(prev => prev.filter(item => item.id !== id));
  };

  return (
    <AppSection description="Preview Mode: Fictional opportunities saved for later review." title="Saved opportunities">
      {savedList.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {savedList.map((opportunity) => {
            const initials = opportunity.owner.name.split(" ").map(n => n[0]).join("").toUpperCase();
            return (
              <Card className="grid gap-4 overflow-hidden p-0" key={opportunity.id}>
                <div className="perx-opportunity-band relative min-h-28 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-[var(--px-radius-sm)] bg-white/15 text-sm font-black ring-1 ring-white/20">
                      {initials}
                    </div>
                    <button
                      onClick={() => removeSaved(opportunity.id)}
                      className="grid h-10 w-10 place-items-center rounded-full bg-amber-400 text-slate-950 ring-1 ring-white/20 cursor-pointer"
                      title="Remove Bookmark"
                    >
                      <Bookmark className="h-4.5 w-4.5" />
                    </button>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold capitalize text-white ring-1 ring-white/20">
                      {opportunity.type.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                      {opportunity.category.name}
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-green-200 bg-green-50 text-green-800">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      Trust {opportunity.owner.trustScore}
                    </Badge>
                    <Badge>
                      <MapPin className="mr-1 h-3.5 w-3.5" />
                      {opportunity.remote ? "Remote" : opportunity.location}
                    </Badge>
                  </div>
                  <div>
                    <button 
                      onClick={() => setSelectedOpp(opportunity)}
                      className="text-left text-xl font-bold text-[color:var(--px-text)] hover:text-[color:var(--px-primary)] cursor-pointer"
                    >
                      {opportunity.title}
                    </button>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">{opportunity.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.skills.map((skill) => (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[color:var(--px-text-muted)]" key={skill}>
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--px-border)] pt-4 text-sm">
                    <span className="font-bold text-[color:var(--px-text)]">
                      {formatBudgetRange(opportunity.budgetMinMinor, opportunity.budgetMaxMinor, opportunity.currency)}
                    </span>
                    <button 
                      onClick={() => setSelectedOpp(opportunity)}
                      className="text-sm font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)] cursor-pointer"
                    >
                      View details
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-[color:var(--px-border)] rounded-[var(--px-radius)]">
          <p className="text-sm text-[color:var(--px-text-muted)]">You have no saved opportunities.</p>
        </div>
      )}

      {/* Mock Detail Dialog */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Opportunity Detail (Preview)
                </span>
                <h2 className="text-2xl font-bold text-slate-950 mt-1">{selectedOpp.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedOpp(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-[color:var(--px-text-muted)]">
                <div>Type: <span className="text-slate-950 font-bold">{selectedOpp.type.replaceAll("_", " ")}</span></div>
                <div>Category: <span className="text-slate-950 font-bold">{selectedOpp.category.name}</span></div>
                <div>Location: <span className="text-slate-950 font-bold">{selectedOpp.remote ? "Remote" : selectedOpp.location}</span></div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm">Description</h3>
                <p className="text-xs text-slate-600 mt-1 leading-6">{selectedOpp.description}</p>
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="text-xs text-[color:var(--px-text-muted)]">Budget range</p>
                  <p className="font-bold text-slate-950 text-base">{formatBudgetRange(selectedOpp.budgetMinMinor, selectedOpp.budgetMaxMinor, selectedOpp.currency)}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppSection>
  );
}
