"use client";

import { useState } from "react";
import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { previewNotifications } from "@/lib/data/preview";
import { Bell, Check, Inbox } from "lucide-react";

export default function PreviewNotificationsPage() {
  const [notifications, setNotifications] = useState(previewNotifications);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  return (
    <AppSection
      actions={
        <button
          onClick={markAllRead}
          className="text-xs font-semibold text-[color:var(--px-primary)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Check size={14} />
          Mark all as read
        </button>
      }
      description="Preview Mode: Platform alerts, deal updates, and moderation status notifications."
      title="Notifications"
    >
      <div className="grid gap-4">
        {notifications.length ? (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`flex items-start gap-4 transition-colors ${
                n.read ? "bg-white/60 border-slate-100" : "bg-white border-[color:var(--px-border)] border-l-4 border-l-[color:var(--px-primary)] shadow-xs"
              }`}
            >
              <div className={`p-2 rounded-full mt-0.5 ${
                n.read ? "bg-slate-100 text-slate-400" : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
              }`}>
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-3">
                  <h3 className={`text-sm font-bold ${n.read ? "text-slate-700" : "text-slate-900"}`}>
                    {n.title}
                  </h3>
                  <span className="text-[10px] text-[color:var(--px-text-muted)] font-semibold capitalize">
                    {n.type.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {n.body}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleRead(n.id)}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {n.read ? "Mark as unread" : "Mark as read"}
                  </button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-12 bg-white border border-[color:var(--px-border)] rounded-[var(--px-radius)]">
            <Inbox className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm text-[color:var(--px-text-muted)]">No notifications.</p>
          </div>
        )}
      </div>
    </AppSection>
  );
}
