import { AppSection } from "@/components/app-section";
import { EmptyState } from "@/components/ui/card";

export default function ReviewsPage() {
  return (
    <AppSection description="Reviews are available only after an eligible completed deal and cannot be duplicated or self-authored." title="Reviews">
      <EmptyState body="Eligible review prompts appear after a deal reaches the released state." title="No review prompts" />
    </AppSection>
  );
}
