import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewReportsPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: reports use a dedicated workspace route separate from admin analytics."
      emptyBody="Preview reports will appear here when sample data is added."
      emptyTitle="No preview reports"
      title="Reports"
    />
  );
}
