"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, Handshake, MapPin,
  MessageCircle, Newspaper, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { dismissOnboardingChecklistAction } from "@/features/onboarding/actions";

const steps = [
  { icon: Newspaper, title: "Start with News", text: "Read updates and messages from the preX team.", href: "/app/news", action: "Open News" },
  { icon: Users, title: "Find people", text: "Search for founders, workers, partners and other members.", href: "/app/discover?type=PEOPLE", action: "Find people" },
  { icon: Handshake, title: "Build your network", text: "Send a connect request. Accept requests from people you know.", href: "/app/connections", action: "Open connections" },
  { icon: MessageCircle, title: "Send messages", text: "Chat with people you are connected to. Check unread messages.", href: "/app/messages", action: "Open messages" },
  { icon: BriefcaseBusiness, title: "Send proposals", text: "Make an offer or reply to a proposal about an opportunity.", href: "/app/proposals/sent", action: "View proposals" },
  { icon: Handshake, title: "Manage deals", text: "See your agreements and what each person needs to do next.", href: "/app/deals", action: "View deals" },
  { icon: MapPin, title: "Track progress", text: "Follow delivery updates and agreement progress in Tracking.", href: "/app/tracking", action: "Open tracking" },
  { icon: ShieldCheck, title: "Build trust", text: "Complete your profile and build a good record through real work.", href: "/app/profile", action: "View profile" },
];

export function WelcomeGuide({ showWelcome }: { showWelcome: boolean }) {
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await dismissOnboardingChecklistAction();
      setClosed(true);
    } finally {
      setSaving(false);
    }
  };

  if (!showWelcome || closed) return null;
  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6">
      <section
        aria-labelledby="prex-guide-title"
        aria-modal="true"
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-[28px] border border-white/15 bg-[color:var(--px-surface)] p-5 text-[color:var(--px-text)] shadow-[0_28px_90px_rgba(0,0,0,0.45)] motion-safe:animate-[guide-enter_380ms_cubic-bezier(.2,.8,.2,1)] sm:p-7"
        role="dialog"
      >
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[color:var(--px-primary)]/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[color:var(--px-primary)]">
            <Sparkles size={15} /> Your preX guide
          </span>
          <button aria-label="Close guide" className="grid size-9 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)]" onClick={() => void finish()} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="relative mt-7 [perspective:900px]">
          <div className="mx-auto grid size-24 place-items-center rounded-[26px] border border-[color:var(--px-primary)]/30 bg-gradient-to-br from-[color:var(--px-primary)] to-indigo-700 text-white shadow-[0_18px_35px_rgba(79,70,229,.35)] transition-transform duration-500 [transform:rotateY(-8deg)_rotateX(7deg)] motion-safe:hover:[transform:rotateY(0deg)_rotateX(0deg)_translateY(-4px)]">
            <Icon size={42} strokeWidth={1.8} />
          </div>
        </div>
        <div className="relative mt-6 text-center" aria-live="polite">
          <p className="text-xs font-bold text-[color:var(--px-text-muted)]">STEP {step + 1} OF {steps.length}</p>
          <h2 id="prex-guide-title" className="mt-2 text-2xl font-black sm:text-3xl">{current.title}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[color:var(--px-text-muted)]">{current.text}</p>
        </div>
        <div className="relative mt-6 flex justify-center gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((item, index) => <span key={item.title} className={`h-1.5 rounded-full transition-all duration-300 ${index === step ? "w-7 bg-[color:var(--px-primary)]" : "w-1.5 bg-[color:var(--px-border-strong)]"}`} />)}
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3">
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--px-border)] px-4 text-sm font-bold disabled:opacity-40" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button">
            <ArrowLeft size={16} /> Back
          </button>
          {step < steps.length - 1 ? (
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white shadow-lg shadow-indigo-900/20" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} type="button">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button className="min-h-12 rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white" onClick={() => void finish()} type="button">
              Finish guide
            </button>
          )}
        </div>
        <div className="relative mt-3 flex items-center justify-between gap-3">
          <Link className="text-xs font-bold text-[color:var(--px-primary)] hover:underline" href={current.href} onClick={() => void finish()}>{current.action}</Link>
          <button className="text-xs font-semibold text-[color:var(--px-text-muted)] hover:underline" disabled={saving} onClick={() => void finish()} type="button">Skip guide</button>
        </div>
      </section>
      <style jsx>{`@keyframes guide-enter { from { opacity: 0; transform: translateY(18px) scale(.96) rotateX(5deg); } to { opacity: 1; transform: translateY(0) scale(1) rotateX(0); } }`}</style>
    </div>
  );
}
