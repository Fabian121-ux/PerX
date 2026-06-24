import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;

  return (
    <AppSection description="Participant authorisation is required before message data is loaded." title="Conversation">
      <Card>
        <p className="text-sm text-slate-600">Conversation workspace: {conversationId}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The MVP data model supports participants, messages, attachments, read receipts, blocking, and reporting. Money movement remains in deal actions.
        </p>
      </Card>
    </AppSection>
  );
}
