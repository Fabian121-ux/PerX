import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function WalletPage() {
  return (
    <WorkspaceEmptyPage
      description="Review wallet activity, balances, and transaction records tied to approved money workflows."
      emptyBody="Wallet balances and transaction history will appear here after payment infrastructure is connected."
      emptyTitle="No wallet activity yet"
      title="Wallet"
    />
  );
}
