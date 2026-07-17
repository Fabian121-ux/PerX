import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewWalletPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: wallet functionality is not active."
      emptyBody="No real funds are collected, held, transferred, or released by perX. Wallet records remain unavailable during beta."
      emptyTitle="Preview wallet unavailable"
      title="Wallet"
    />
  );
}
