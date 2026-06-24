"use client";

import { useState, useRef, useEffect } from "react";
import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { previewConversation } from "@/lib/data/preview";
import { Send, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function PreviewConversationPage() {
  const [messages, setMessages] = useState(previewConversation.messages);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage = {
      id: `msg-custom-${Date.now()}`,
      body: inputText,
      senderId: "alex-demo",
      senderName: "Alex Morgan",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <AppSection
      actions={
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--px-primary)] hover:underline" href="/preview/messages">
          <ArrowLeft size={16} />
          Back to list
        </Link>
      }
      description={`Fictional chat workspace with ${previewConversation.participantName} regarding "${previewConversation.opportunityTitle}"`}
      title={previewConversation.participantName}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Chat area */}
        <div className="flex flex-col h-[500px] border border-[color:var(--px-border)] bg-white rounded-[var(--px-radius)] overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700">Maya is active now</span>
            </div>
            <span className="text-[11px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Mock Conversation
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isMe = msg.senderId === "alex-demo";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${
                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <span className="text-[10px] text-[color:var(--px-text-muted)] font-semibold mb-1">
                    {msg.senderName}
                  </span>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs leading-5 ${
                      isMe
                        ? "bg-[color:var(--px-primary)] text-white rounded-tr-none"
                        : "bg-slate-100 text-slate-900 rounded-tl-none"
                    }`}
                  >
                    {msg.body}
                  </div>
                  <span className="text-[9px] text-[color:var(--px-text-muted)] mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Form input */}
          <form onSubmit={handleSend} className="border-t border-slate-100 p-3 bg-slate-50 flex gap-2">
            <input
              type="text"
              placeholder="Type a mock message..."
              className="flex-1 px-3 py-2 border border-[color:var(--px-border)] rounded-[var(--px-radius-sm)] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[color:var(--px-primary)]"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button
              type="submit"
              className="grid place-items-center h-9 w-9 bg-[color:var(--px-primary)] text-white rounded-lg hover:bg-[color:var(--px-primary-strong)] transition-colors cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>
        </div>

        {/* Sidebar panel */}
        <div className="grid gap-6 self-start">
          <Card className="p-4 grid gap-3">
            <h3 className="font-bold text-slate-950 text-sm">Participant details</h3>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs">
                MC
              </div>
              <div>
                <h4 className="font-bold text-slate-950 text-xs">{previewConversation.participantName}</h4>
                <p className="text-[10px] text-[color:var(--px-text-muted)] mt-0.5">@{previewConversation.participantUsername}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-green-800 font-semibold bg-green-50 border border-green-200 rounded p-2">
              <ShieldCheck size={16} />
              <span>Trust Score: 86</span>
            </div>
          </Card>

          <Card className="p-4 grid gap-2">
            <h3 className="font-bold text-slate-950 text-sm">Linked actions</h3>
            <p className="text-xs text-[color:var(--px-text-muted)] leading-5">
              An accepted proposal is active for this workspace.
            </p>
            <div className="grid gap-2 mt-2">
              <Link
                className="text-xs font-semibold text-center text-white bg-slate-900 hover:bg-slate-800 rounded p-2 transition-colors"
                href="/preview/deals/demo-deal"
              >
                Go to Deal Workspace
              </Link>
              <Link
                className="text-xs font-semibold text-center text-slate-700 bg-slate-100 hover:bg-slate-200 rounded p-2 transition-colors"
                href="/preview/proposals/sent"
              >
                View Proposal
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppSection>
  );
}
