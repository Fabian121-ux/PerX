import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewEscrowPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: simulated deal-state records only. Payment and escrow functionality is not active."
      emptyBody="No real funds are collected or held by perX. Simulated state records appear only inside demo deal workflows."
      emptyTitle="No simulated state records"
      title="Simulated escrow"
    />
  );
}
