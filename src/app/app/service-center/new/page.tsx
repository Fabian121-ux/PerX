import { AppSection } from "@/components/app-section";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { Card } from "@/components/ui/card";

export default function NewSupportTicketPage() {
  return (
    <AppSection
      title="Create Support Ticket"
      description="Submit a new request for help with your account, deals, or other issues."
    >
      <Card className="max-w-2xl">
        <SupportTicketForm />
      </Card>
    </AppSection>
  );
}
