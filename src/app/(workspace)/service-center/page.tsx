import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function ServiceCenterPage() {
  return (
    <WorkspaceEmptyPage
      description="Get support for account access, marketplace workflows, deals, escrow, and trust issues."
      emptyBody="Support tickets and service updates will appear here after service-center workflows are enabled."
      emptyTitle="No support tickets yet"
      title="Service Center"
    />
  );
}
