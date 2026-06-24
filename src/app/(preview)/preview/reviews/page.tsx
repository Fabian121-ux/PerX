import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { previewReviews } from "@/lib/data/preview";
import { Star } from "lucide-react";

export default function PreviewReviewsPage() {
  return (
    <AppSection description="Preview Mode: Fictional ratings and reviews tied to completed marketplace deals." title="Trust reviews">
      <div className="grid gap-4">
        {previewReviews.map((review) => (
          <Card key={review.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950 text-base">{review.authorName}</h3>
                <p className="text-xs text-[color:var(--px-text-muted)] mt-0.5">{review.authorHeadline}</p>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="fill-amber-400 text-amber-400" size={15} />
                ))}
                <span className="text-xs text-[color:var(--px-text-muted)] font-medium ml-1.5">{review.createdAt}</span>
              </div>
            </div>
            <h4 className="mt-4 font-bold text-slate-900 text-sm">{review.title}</h4>
            <p className="mt-2 text-xs leading-6 text-slate-600">{review.body}</p>
          </Card>
        ))}
      </div>
    </AppSection>
  );
}
