import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function TravelStayPage() {
  return (
    <WorkspaceEmptyPage
      description="Track travel, accommodation, and stay-related opportunities that need trusted coordination."
      emptyBody="Travel and stay listings will appear here after they are added to the marketplace."
      emptyTitle="No travel or stay listings yet"
      title="Travel & Stay"
    />
  );
}
