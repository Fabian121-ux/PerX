import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewServiceCenterPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: support requests and service updates use the approved service-center route."
      emptyBody="Preview support tickets will appear here when sample data is added."
      emptyTitle="No preview support tickets"
      title="Service Center"
    />
  );
}
