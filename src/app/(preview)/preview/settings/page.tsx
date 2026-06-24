"use client";

import { useState } from "react";
import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PreviewSettingsPage() {
  const [emailNotify, setEmailNotify] = useState(true);
  const [smsNotify, setSmsNotify] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
    }, 2000);
  };

  return (
    <AppSection description="Preview Mode: Manage account preferences and simulated notification channels." title="Account settings">
      <div className="grid gap-6 max-w-2xl">
        {success && (
          <div className="rounded-[var(--px-radius-sm)] bg-green-50 p-4 border border-green-200 text-center text-xs font-semibold text-green-800">
            ✓ Mock Settings Saved!
          </div>
        )}
        
        <Card>
          <h2 className="font-bold text-slate-950 text-base mb-4">Notification Preferences</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50">
              <div>
                <label className="text-xs font-bold text-slate-900 block" htmlFor="email-notif">Email Notifications</label>
                <span className="text-[10px] text-[color:var(--px-text-muted)] mt-0.5">Receive deal and proposal status alerts via email.</span>
              </div>
              <input
                type="checkbox"
                id="email-notif"
                className="h-4 w-4 rounded border-slate-300 text-[color:var(--px-primary)] focus:ring-[color:var(--px-primary)]"
                checked={emailNotify}
                onChange={() => setEmailNotify(!emailNotify)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50">
              <div>
                <label className="text-xs font-bold text-slate-900 block" htmlFor="sms-notif">SMS Alerts</label>
                <span className="text-[10px] text-[color:var(--px-text-muted)] mt-0.5">Receive immediate milestone alerts via phone.</span>
              </div>
              <input
                type="checkbox"
                id="sms-notif"
                className="h-4 w-4 rounded border-slate-300 text-[color:var(--px-primary)] focus:ring-[color:var(--px-primary)]"
                checked={smsNotify}
                onChange={() => setSmsNotify(!smsNotify)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit">
                Save Mock Preferences
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950 text-base mb-2">Security</h2>
          <p className="text-xs text-[color:var(--px-text-muted)] leading-5">
            Security settings are active for your main account session. In Preview Mode, authentication is simulated and password/email updates are disabled.
          </p>
        </Card>
      </div>
    </AppSection>
  );
}
