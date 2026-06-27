import { AppSection } from "@/components/app-section";
import { EmptyState } from "@/components/ui/card";

export function WorkspaceEmptyPage({
  description,
  emptyBody,
  emptyTitle,
  title,
}: {
  description: string;
  emptyBody: string;
  emptyTitle: string;
  title: string;
}) {
  return (
    <AppSection description={description} title={title}>
      <EmptyState body={emptyBody} title={emptyTitle} />
    </AppSection>
  );
}
