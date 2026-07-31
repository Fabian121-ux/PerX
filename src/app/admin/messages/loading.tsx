import { Card } from "@/components/ui/card";

export default function AdminMessagesLoading() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="h-7 w-56 animate-pulse rounded bg-white/15" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-white/10" />
      </div>
      {[0, 1, 2].map((item) => (
        <Card className="grid gap-4 bg-white/95" key={item}>
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-20 animate-pulse rounded bg-slate-100" />
        </Card>
      ))}
    </div>
  );
}
