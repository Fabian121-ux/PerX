"use client";

import { useState } from "react";
import { ListFilter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

type FilterDrawerCategory = {
  name: string;
  slug: string;
};

const typeOptions = [
  ["", "All listings"],
  ["JOB", "Jobs"],
  ["FREELANCE_PROJECT", "Projects"],
  ["STARTUP", "Startups"],
  ["COFOUNDER", "Co-founders"],
  ["PARTNERSHIP", "Partnerships"],
  ["SERVICE", "Services"],
];

export function MobileFilterDrawer({
  basePath,
  categories,
  params,
}: {
  basePath: string;
  categories: FilterDrawerCategory[];
  params: { category?: string; q?: string; type?: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 text-sm font-semibold text-[color:var(--px-text)] xl:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <ListFilter size={16} />
        Filters
      </button>

      {open ? (
        <div
          aria-label="Search filters"
          aria-modal="true"
          className="fixed inset-0 z-50 xl:hidden"
          role="dialog"
        >
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-[color:var(--px-overlay)]"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[24px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 shadow-[var(--px-shadow-strong)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[color:var(--px-text)]">
                  Filters
                </h2>
                <p className="text-xs text-[color:var(--px-text-muted)]">
                  Refine the current discovery results.
                </p>
              </div>
              <button
                aria-label="Close filters"
                className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form action={basePath} className="mt-5 grid gap-4">
              <Field label="Search">
                <Input
                  defaultValue={params.q}
                  name="q"
                  placeholder="Role, skill, company or keyword"
                />
              </Field>
              <Field label="Listing type">
                <Select defaultValue={params.type ?? ""} name="type">
                  {typeOptions.map(([value, label]) => (
                    <option key={value || "all"} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Select defaultValue={params.category ?? ""} name="category">
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">
                <Search aria-hidden className="mr-2" size={16} />
                Apply filters
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
