import type { ReactNode } from "react";

import { Card, EmptyState } from "@/components/ui/card";

export function AdminSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AdminList({
  empty,
  items,
  render,
}: {
  empty: string;
  items: unknown[];
  render: (item: unknown) => ReactNode;
}) {
  if (!items.length) {
    return <EmptyState body="Connect PostgreSQL and seed data to populate this operational queue." title={empty} />;
  }

  return <div className="grid gap-3">{items.map((item, index) => <Card key={index}>{render(item)}</Card>)}</div>;
}
