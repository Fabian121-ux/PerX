import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewServicesPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: services are displayed as trusted marketplace workflows."
      emptyBody="Preview services will appear here when sample data is added."
      emptyTitle="No preview services"
      title="Services"
    />
  );
}
