"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export default function PreviewCreateOpportunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      
      // Redirect after message
      setTimeout(() => {
        router.push("/preview/opportunities");
      }, 1500);
    }, 800);
  };

  return (
    <AppSection description="Preview Mode: Post a fictional work request into the ecosystem." title="New opportunity">
      <Card className="max-w-2xl">
        {success ? (
          <div className="rounded-[var(--px-radius-sm)] bg-green-50 p-4 border border-green-200 text-center">
            <h3 className="font-bold text-green-950">✓ Mock Opportunity Created!</h3>
            <p className="mt-1.5 text-xs text-green-800">Returning to opportunities list...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <Field label="Opportunity Title">
              <Input placeholder="e.g. Build responsive Next.js landing page" required name="title" />
            </Field>

            <Field label="Short Summary">
              <Input placeholder="Describe the outcome in one line" required name="summary" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select 
                  className="min-h-11 w-full rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                  required
                  name="category"
                >
                  <option value="software">Software</option>
                  <option value="design">Design</option>
                  <option value="operations">Operations</option>
                </select>
              </Field>

              <Field label="Type">
                <select 
                  className="min-h-11 w-full rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                  required
                  name="type"
                >
                  <option value="FREELANCE_PROJECT">Freelance Project</option>
                  <option value="JOB">Full-time Job</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Budget Minimum ($)">
                <Input type="number" placeholder="2000" required name="budgetMin" />
              </Field>

              <Field label="Budget Maximum ($)">
                <Input type="number" placeholder="5000" required name="budgetMax" />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="remote" name="remote" defaultChecked className="h-4 w-4 rounded border-slate-300 text-[color:var(--px-primary)] focus:ring-[color:var(--px-primary)]" />
              <label htmlFor="remote" className="text-sm font-semibold text-slate-900">This is a fully remote position</label>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <ButtonLink href="/preview/opportunities" variant="ghost">
                Cancel
              </ButtonLink>
              <Button type="submit" disabled={loading}>
                {loading ? "Publishing..." : "Publish Mock Opportunity"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </AppSection>
  );
}
