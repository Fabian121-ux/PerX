import { MessageWorkspace, type WorkspaceConversation } from "@/components/messages/message-workspace";
import {
  previewActiveDeal,
  previewConversation,
  previewUser,
} from "@/lib/data/preview";

export default function PreviewConversationPage() {
  const conversation: WorkspaceConversation = {
    context: previewConversation.opportunityTitle,
    deal: {
      amountMinor: String(previewActiveDeal.valueMinor),
      currency: previewActiveDeal.currency,
      id: previewActiveDeal.id,
      settlementMode: "SIMULATED",
      status: previewActiveDeal.status,
      title: previewActiveDeal.title,
      versionLabel: "v1",
    },
    dealHref: "/preview/deals/demo-deal",
    events: [
      {
        actorName: "Alex Morgan",
        createdAt: "2026-06-23T12:35:00Z",
        id: "event-proposal-1",
        proposalVersionId: "preview-version-1",
        snapshot: {
          amountMinor: "64000000",
          currency: "NGN",
          deliveryDays: 28,
          description:
            "Discovery, UX structure, high-fidelity product screens, and design-system handoff.",
          includedRevisions: 2,
          schemaVersion: 1,
          versionNumber: 1,
        },
        type: "PROPOSAL_SUBMITTED",
      },
      {
        actorName: "Maya Chen",
        createdAt: "2026-06-23T13:05:00Z",
        dealHref: "/preview/deals/demo-deal",
        id: "event-deal-1",
        proposalVersionId: "preview-version-1",
        snapshot: {
          amountMinor: "64000000",
          currency: "NGN",
          onlinePaymentActive: false,
          schemaVersion: 1,
          settlementMode: "SIMULATED",
          status: "AWAITING_FUNDING",
          title: "Trust-led onboarding redesign",
          versionNumber: 1,
        },
        type: "DEAL_CREATED",
      },
    ],
    id: previewConversation.id,
    lastMessage: previewConversation.lastMessage,
    messages: previewConversation.messages,
    opportunityTitle: previewConversation.opportunityTitle,
    participantName: previewConversation.participantName,
    participantRole: "Client · verified opportunity owner",
    participantUsername: previewConversation.participantUsername,
    timestamp: "2m",
    unreadCount: 0,
  };

  return (
    <MessageWorkspace
      backHref="/preview/messages"
      conversations={[conversation]}
      currentUserId={previewUser.id}
      defaultConversationId={previewConversation.id}
    />
  );
}
