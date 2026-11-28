import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { PushNotificationManager } from "@/components/pwa/push-notification-manager";

export default function NotificationSettingsPage() {
  return (
    <AppSection
      description="Manage push alerts for this installed device."
      title="Notification settings"
    >
      <Card className="mx-auto w-full max-w-2xl">
        <PushNotificationManager mode="settings" />
      </Card>
    </AppSection>
  );
}
