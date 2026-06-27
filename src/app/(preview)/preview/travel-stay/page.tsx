import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewTravelStayPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: travel and stay opportunities are reserved for the approved app navigation."
      emptyBody="Preview travel and stay listings will appear here when sample data is added."
      emptyTitle="No preview travel listings"
      title="Travel & Stay"
    />
  );
}
