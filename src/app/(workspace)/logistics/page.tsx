import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function LogisticsPage() {
  return (
    <WorkspaceEmptyPage
      description="Coordinate delivery, shipping, and logistics opportunities with trusted service providers."
      emptyBody="Logistics requests and provider matches will appear here once they are available."
      emptyTitle="No logistics activity yet"
      title="Logistics"
    />
  );
}
