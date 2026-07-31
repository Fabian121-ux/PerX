import { Card } from "@/components/ui/card";

export default function AdminCaseLoading() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <Card className="grid gap-3 bg-white/95" key={item}>
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-16 animate-pulse rounded bg-slate-100" />
          </Card>
        ))}
      </div>
      <Card className="h-64 animate-pulse bg-white/95">
        <span className="sr-only">Loading case actions</span>
      </Card>
    </div>
  );
}
