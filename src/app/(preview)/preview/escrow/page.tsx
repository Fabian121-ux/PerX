import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewEscrowPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: escrow activity is separated from general deal navigation."
      emptyBody="Preview escrow records will appear here when sample data is added."
      emptyTitle="No preview escrow records"
      title="Escrow"
    />
  );
}
