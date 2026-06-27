import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function PreviewNetworkPage() {
  return (
    <WorkspaceEmptyPage
      description="Preview Mode: review how network and friend activity will sit inside the perX app shell."
      emptyBody="Preview network requests and trusted connections will appear here when sample data is added."
      emptyTitle="No preview network activity"
      title="Network/Friends"
    />
  );
}
