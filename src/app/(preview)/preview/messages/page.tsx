import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { previewConversations } from "@/lib/data/preview";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PreviewMessagesPage() {
  return (
    <AppSection description="Preview Mode: Active chat workspaces with potential collaborators." title="Messages">
      <div className="grid gap-4">
        {previewConversations.map((conv) => {
          const initials = conv.participantName.split(" ").map(n => n[0]).join("").toUpperCase();
          return (
            <Card key={conv.id} className="p-0 overflow-hidden hover:shadow-[var(--px-shadow-strong)] transition-shadow">
              <Link className="flex items-center justify-between p-5 gap-4" href={`/preview/messages/demo-conversation`}>
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)] font-bold text-sm">
                    {initials}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950 text-base">{conv.participantName}</h2>
                    <p className="text-xs text-[color:var(--px-text-muted)] mt-0.5">Project: {conv.opportunityTitle}</p>
                    <p className="text-xs text-slate-600 mt-2 truncate max-w-md italic">
                      &ldquo;{conv.lastMessage}&rdquo;
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--px-primary)]">
                  <span>Open Chat</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            </Card>
          );
        })}
      </div>
    </AppSection>
  );
}
