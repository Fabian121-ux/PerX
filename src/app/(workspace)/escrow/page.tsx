import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function EscrowPage() {
  return (
    <WorkspaceEmptyPage
      description="Payment and escrow functionality is not active during this beta."
      emptyBody="No real funds are collected or held by perX. Simulated deal states will appear here only for workflow testing."
      emptyTitle="No simulated state records yet"
      title="Escrow"
    />
  );
}
