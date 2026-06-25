import { MessageWorkspace, type WorkspaceConversation } from "@/components/messages/message-workspace";
import { previewConversation, previewUser } from "@/lib/data/preview";

export default function PreviewConversationPage() {
  const conversation: WorkspaceConversation = {
    context: previewConversation.opportunityTitle,
    dealHref: "/preview/deals/demo-deal",
    id: previewConversation.id,
    lastMessage: previewConversation.lastMessage,
    messages: previewConversation.messages,
    opportunityTitle: previewConversation.opportunityTitle,
    participantName: previewConversation.participantName,
    participantRole: "Client · verified opportunity owner",
    participantUsername: previewConversation.participantUsername,
    timestamp: "2m",
    trustScore: 86,
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
