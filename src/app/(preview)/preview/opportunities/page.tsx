"use client";

import { useState } from "react";
import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { previewOpportunities } from "@/lib/data/preview";
import { formatBudgetRange } from "@/lib/money";
import { Bookmark, MapPin, ShieldCheck, Search } from "lucide-react";

export default function PreviewOpportunitiesPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOpp, setSelectedOpp] = useState<typeof previewOpportunities[0] | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [proposalSubmitted, setProposalSubmitted] = useState<string | null>(null);

  const categories = [
    { label: "All Areas", value: "all" },
    { label: "Software", value: "software" },
    { label: "Design", value: "design" },
    { label: "Operations", value: "operations" },
  ];

  const filteredOpportunities = previewOpportunities.filter((opp) => {
    const matchesSearch = 
      opp.title.toLowerCase().includes(search.toLowerCase()) ||
      opp.summary.toLowerCase().includes(search.toLowerCase()) ||
      opp.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || opp.category.slug === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const toggleSave = (id: string) => {
    setSavedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <AppSection 
      actions={<ButtonLink href="/preview/opportunities/new">New opportunity</ButtonLink>} 
      description="Preview Mode: Discover and filter professional ecosystem opportunities." 
      title="Opportunities"
    >
      <div className="grid gap-6">
        {/* Search and Filter bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[color:var(--px-text-muted)]" />
            <input
              type="text"
              placeholder="Search opportunities, skills, keywords..."
              className="w-full pl-10 pr-4 py-2 border border-[color:var(--px-border)] rounded-[var(--px-radius-sm)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--px-primary)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                  selectedCategory === cat.value
                    ? "bg-[color:var(--px-primary)] border-[color:var(--px-primary)] text-white shadow-sm"
                    : "bg-white border-[color:var(--px-border)] text-[color:var(--px-text-muted)] hover:bg-slate-50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Opportunity Card list */}
        {filteredOpportunities.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredOpportunities.map((opportunity) => {
              const isSaved = savedIds.includes(opportunity.id);
              const initials = opportunity.owner.name.split(" ").map(n => n[0]).join("").toUpperCase();
              return (
                <Card className="grid gap-4 overflow-hidden p-0" key={opportunity.id}>
                  <div className="perx-opportunity-band relative min-h-28 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-[var(--px-radius-sm)] bg-white/15 text-sm font-black ring-1 ring-white/20">
                        {initials}
                      </div>
                      <button
                        onClick={() => toggleSave(opportunity.id)}
                        className={`grid h-10 w-10 place-items-center rounded-full transition ring-1 ring-white/20 ${
                          isSaved ? "bg-amber-400 text-slate-950" : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                        type="button"
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
          <div className="text-center py-10 bg-white border border-[color:var(--px-border)] rounded-[var(--px-radius)]">
            <p className="text-sm text-[color:var(--px-text-muted)]">No opportunities found matching your criteria.</p>
          </div>
        )}
      </div>

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
                onClick={() => {
                  setSelectedOpp(null);
                  setProposalSubmitted(null);
                }}
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

              <div>
                <h3 className="font-bold text-slate-900 text-sm">Required Skills</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedOpp.skills.map((skill) => (
                    <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="text-xs text-[color:var(--px-text-muted)]">Budget range</p>
                  <p className="font-bold text-slate-950 text-base">{formatBudgetRange(selectedOpp.budgetMinMinor, selectedOpp.budgetMaxMinor, selectedOpp.currency)}</p>
                </div>
                
                {proposalSubmitted === selectedOpp.id ? (
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                    ✓ Mock Proposal Submitted successfully!
                  </span>
                ) : (
                  <Button 
                    onClick={() => setProposalSubmitted(selectedOpp.id)}
                    variant="warm"
                  >
                    Submit Mock Proposal
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppSection>
  );
}
