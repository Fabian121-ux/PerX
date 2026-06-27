import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function EscrowPage() {
  return (
    <WorkspaceEmptyPage
      description="Monitor protected funds and release states for eligible deals."
      emptyBody="Escrow records will appear here when a deal reaches a funded or release-ready state."
      emptyTitle="No escrow records yet"
      title="Escrow"
    />
  );
}
