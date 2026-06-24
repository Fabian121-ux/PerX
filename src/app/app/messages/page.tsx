import Link from "next/link";

import { AppSection } from "@/components/app-section";
import { Card, EmptyState } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversations } from "@/lib/data/app";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  const conversations = await getConversations(user!.id);

  return (
    <AppSection description="Messages are for communication only. They do not control money or deal state." title="Messages">
      {conversations.length ? (
        <div className="grid gap-4">
          {conversations.map((conversation) => (
            <Card key={conversation.id}>
              <Link className="font-semibold text-slate-950 hover:text-emerald-700" href={`/app/messages/${conversation.id}`}>
                {conversation.opportunity?.title ?? "Conversation"}
              </Link>
              <p className="mt-2 text-sm text-slate-600">{conversation.messages[0]?.body ?? "No messages yet."}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState body="A conversation is created when a proposal is submitted." title="No conversations" />
      )}
    </AppSection>
  );
}
