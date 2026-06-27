import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function NetworkPage() {
  return (
    <WorkspaceEmptyPage
      description="Manage trusted connections, friend requests, and professional relationship activity."
      emptyBody="Accepted connections, requests, and suggested collaborators will appear here once network workflows are enabled."
      emptyTitle="No network activity yet"
      title="Network/Friends"
    />
  );
}
