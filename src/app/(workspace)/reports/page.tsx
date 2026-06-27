import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function ReportsPage() {
  return (
    <WorkspaceEmptyPage
      description="Review account, deal, and marketplace reports that support trusted activity."
      emptyBody="Saved reports and downloadable summaries will appear here after reporting workflows are available."
      emptyTitle="No reports yet"
      title="Reports"
    />
  );
}
