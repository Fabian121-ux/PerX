"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ListFilter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

type FilterDrawerCategory = {
  name: string;
  slug: string;
};

const typeOptions = [
  ["", "All"],
  ["OPPORTUNITY", "Opportunities"],
  ["PEOPLE", "People"],
  ["JOB", "Work"],
  ["SERVICE", "Services"],
  ["PARTNERSHIP", "Partnerships"],
  ["BUSINESS", "Businesses"],
  ["MARKETPLACE", "Marketplace"],
];

export function MobileFilterDrawer({
  basePath,
  categories,
  params,
}: {
  basePath: string;
  categories: FilterDrawerCategory[];
  params: { category?: string; q?: string; sort?: string; type?: string };
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 text-sm font-semibold text-[color:var(--px-text)] transition hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] xl:hidden"
          type="button"
        >
          <ListFilter aria-hidden size={16} />
          Filters
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color:var(--px-overlay)] xl:hidden" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[86dvh] overflow-y-auto rounded-t-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 shadow-[var(--px-shadow-strong)] focus:outline-none xl:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-black text-[color:var(--px-text)]">
                Filters
              </Dialog.Title>
              <Dialog.Description className="text-xs text-[color:var(--px-text-muted)]">
                Refine the current discovery results.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close filters"
                className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                type="button"
              >
                <X aria-hidden size={18} />
              </button>
            </Dialog.Close>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
