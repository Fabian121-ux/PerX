"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Compass,
  MessageCircle,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { dismissOnboardingChecklistAction } from "@/features/onboarding/actions";

const STEPS = [
  {
    title: "Your home feed",
    body: "Catch up on updates from founders, members and the wider startup ecosystem. Your feed is the starting point for activity.",
    href: "/app",
    action: "Open home",
    icon: Compass,
  },
  {
    title: "Discover opportunities",
    body: "Explore people, startups, services and opportunities. Use discovery to find relevant connections and openings.",
    href: "/app/discover",
    action: "Explore discovery",
    icon: Compass,
  },
  {
    title: "Messages and conversations",
    body: "Start a conversation, ask questions and discuss opportunities. Eligible conversations also give you access to Deal tools.",
    href: "/app/messages",
    action: "Open Messages",
    icon: MessageCircle,
  },
  {
    title: "Deals and progress",
    body: "Review proposals and accepted agreements. Available actions depend on the opportunity and permissions of both participants.",
    href: "/app/deals",
    action: "View Deals",
    icon: BriefcaseBusiness,
  },
  {
    title: "Your account and settings",
    body: "Manage your profile, security and preferences. Keep your email address current so recovery messages can reach you.",
    href: "/app/settings",
    action: "Open Settings",
    icon: Settings2,
  },
] as const;

export function WelcomeGuide({ showWelcome }: { showWelcome: boolean }) {
  const router = useRouter();
  const dismissedRef = useRef(!showWelcome);
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function persistDismissal() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    startTransition(async () => {
      try {
        await dismissOnboardingChecklistAction();
      } catch {
        // The user can keep navigating. The welcome may be shown again next visit.
        dismissedRef.current = false;
      }
    });
  }

  function closeWelcome() {
    setWelcomeOpen(false);
    persistDismissal();
  }

  function startTour() {
    setWelcomeOpen(false);
    persistDismissal();
    setStepIndex(0);
  }

  function openMessages() {
    closeWelcome();
    router.push("/app/messages");
  }

  const step = stepIndex === null ? null : STEPS[stepIndex];
  const StepIcon = step?.icon;

  return (
    <>
      <Dialog.Root
        open={welcomeOpen}
        onOpenChange={(open) => {
          if (!open) closeWelcome();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm" />
          <Dialog.Content className="ptahx-welcome-dialog fixed left-1/2 top-1/2 z-[81] grid max-h-[min(86dvh,42rem)] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-3xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 text-[color:var(--px-text)] shadow-2xl outline-none sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)]">
                <Sparkles aria-hidden size={24} />
              </span>
              <Dialog.Close asChild>
                <button
                  aria-label="Close welcome message"
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  type="button"
                >
                  <X aria-hidden size={20} />
                </button>
              </Dialog.Close>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--px-primary-ink)]">
                Welcome to preX
              </p>
              <Dialog.Title className="mt-2 text-2xl font-black leading-tight text-[color:var(--px-text)] sm:text-3xl">
                A good place to start.
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-7 text-[color:var(--px-text-muted)]">
                You’re now in the preX startup community. Explore the feed,
                discover opportunities, connect with people and manage your
                account from Settings. You can open Messages whenever you want
                to ask a question or continue a discussion.
              </Dialog.Description>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-3">
                <Compass aria-hidden className="mt-0.5 shrink-0 text-[color:var(--px-primary-ink)]" size={19} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Explore</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Browse the feed and discover opportunities.</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3">
                <MessageCircle aria-hidden className="mt-0.5 shrink-0 text-[color:var(--px-primary-ink)]" size={19} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Have a conversation</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Find your conversations in Messages.</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 sm:col-span-2">
                <Settings2 aria-hidden className="mt-0.5 shrink-0 text-[color:var(--px-primary-ink)]" size={19} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Make it yours</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Visit Settings to manage your account and preferences.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="w-full" disabled={pending} onClick={startTour} type="button">
                Take the quick tour <ArrowRight aria-hidden className="ml-2" size={17} />
              </Button>
              <Button className="w-full" disabled={pending} onClick={openMessages} type="button" variant="outline">
                <MessageCircle aria-hidden className="mr-2" size={17} />
                Go to Messages
              </Button>
            </div>
            <button
              className="min-h-11 justify-self-center px-3 text-sm font-semibold text-[color:var(--px-text-muted)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              disabled={pending}
              onClick={closeWelcome}
              type="button"
            >
              I’ll explore on my own
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {!welcomeOpen && stepIndex === null ? (
        <button
          aria-label="Open the preX getting started guide"
          className="ptahx-guide-launcher fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+1rem)] right-4 z-[55] inline-flex min-h-11 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-3 text-sm font-bold text-[color:var(--px-text)] shadow-xl transition hover:-translate-y-0.5 hover:border-[color:var(--px-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:bottom-6 lg:right-6"
          onClick={() => setStepIndex(0)}
          type="button"
        >
          <Compass aria-hidden className="shrink-0 text-[color:var(--px-primary-ink)]" size={18} />
          Guide
        </button>
      ) : null}

      {step && StepIcon ? (
        <section
          aria-label="preX getting started guide"
          aria-live="polite"
          className="ptahx-guide-card fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+1rem)] right-3 z-[56] grid max-h-[min(62dvh,28rem)] w-[min(23rem,calc(100vw-1.5rem))] gap-4 overflow-y-auto rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 text-[color:var(--px-text)] shadow-2xl sm:right-5 sm:p-5 lg:bottom-6 lg:right-6"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--px-primary-ink)]">
              Getting started · {stepIndex! + 1} of {STEPS.length}
            </p>
            <button
              aria-label="Close guide"
              className="grid size-10 shrink-0 place-items-center rounded-lg text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              onClick={() => setStepIndex(null)}
              type="button"
            >
              <X aria-hidden size={18} />
            </button>
          </div>

          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)]">
              <StepIcon aria-hidden size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">{step.body}</p>
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--px-surface-soft)]">
            <div
              className="h-full rounded-full bg-[color:var(--px-primary)] transition-[width] duration-200"
              style={{ width: `${((stepIndex! + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] disabled:opacity-40"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => current === null ? null : Math.max(0, current - 1))}
              type="button"
            >
              <ArrowLeft aria-hidden size={16} /> Back
            </button>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--px-primary-ink)] hover:bg-[color:var(--px-primary-soft)]"
                href={step.href}
                onClick={() => setStepIndex(null)}
              >
                {step.action}
              </Link>
              {stepIndex! < STEPS.length - 1 ? (
                <Button
                  onClick={() => setStepIndex((current) => current === null ? null : Math.min(STEPS.length - 1, current + 1))}
                  size="sm"
                  type="button"
                >
                  Next <ArrowRight aria-hidden className="ml-1" size={15} />
                </Button>
              ) : (
                <Button onClick={() => setStepIndex(null)} size="sm" type="button">
                  Finish
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
