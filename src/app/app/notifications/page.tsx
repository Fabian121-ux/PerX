import { AppSection } from "@/components/app-section";
import { EmptyState } from "@/components/ui/card";

export default function NotificationsPage() {
  return (
    <AppSection description="Notifications highlight proposal, deal, review, and moderation events." title="Notifications">
      <EmptyState body="New account and workflow notifications will appear here." title="No notifications" />
    </AppSection>
  );
}
