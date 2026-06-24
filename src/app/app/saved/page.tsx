import { AppSection } from "@/components/app-section";
import { EmptyState } from "@/components/ui/card";

export default function SavedOpportunitiesPage() {
  return (
    <AppSection description="Bookmarked opportunities are persisted per user and never served through public cache." title="Saved opportunities">
      <EmptyState body="Save an opportunity from its detail page and it will appear here." title="No saved opportunities yet" />
    </AppSection>
  );
}
