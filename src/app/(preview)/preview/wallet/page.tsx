import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewWalletPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: wallet records stay inside the app shell without exposing private cached data."
      emptyBody="Preview wallet activity will appear here when sample data is added."
      emptyTitle="No preview wallet activity"
      title="Wallet"
    />
  );
}
