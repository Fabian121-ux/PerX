import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function WalletPage() {
  return (
    <WorkspaceEmptyPage
      description="Wallet functionality is not active during this beta."
      emptyBody="No real funds are collected, held, transferred, or released by perX. Wallet records will stay unavailable until compliant payment infrastructure is connected."
      emptyTitle="Wallet unavailable during beta"
      title="Wallet"
    />
  );
}
