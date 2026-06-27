import { WorkspaceEmptyPage } from "@/components/dashboard/workspace-empty-page";

export default function ServicesPage() {
  return (
    <WorkspaceEmptyPage
      description="Find service providers and service requests that can progress into protected deals."
      emptyBody="Service listings and requests will appear here when service discovery is connected."
      emptyTitle="No services available yet"
      title="Services"
    />
  );
}
