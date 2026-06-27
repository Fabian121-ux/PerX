import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewRealEstatePage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: real estate opportunities use the approved marketplace route pattern."
      emptyBody="Preview property listings will appear here when sample data is added."
      emptyTitle="No preview real estate listings"
      title="Real Estate"
    />
  );
}
