import { MessageWorkspace, type WorkspaceConversation } from "@/components/messages/message-workspace";
import { previewConversation, previewConversations, previewUser } from "@/lib/data/preview";

export default function PreviewMessagesPage() {
  const conversations: WorkspaceConversation[] = previewConversations.map((conversation) => ({
    context: conversation.opportunityTitle,
    dealHref: conversation.id === previewConversation.id ? "/preview/deals/demo-deal" : undefined,
    id: conversation.id,
    lastMessage: conversation.lastMessage,
    messages: conversation.messages,
    opportunityTitle: conversation.opportunityTitle,
    participantName: conversation.participantName,
    participantRole: "Client · verified opportunity owner",
    participantUsername: conversation.participantUsername,
    timestamp: "2m",
    trustScore: 86,
    unreadCount: 2,
  }));

  return <MessageWorkspace conversations={conversations} currentUserId={previewUser.id} />;
}
