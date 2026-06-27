import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewLogisticsPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: logistics requests use the same protected workflow shell."
      emptyBody="Preview logistics requests will appear here when sample data is added."
      emptyTitle="No preview logistics requests"
      title="Logistics"
    />
  );
}
