"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Check, Compass, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { dismissFirstRunGuideAction } from "@/features/onboarding/actions";

const GUIDE_STEPS = [
  {
    title: "Your home feed",
    description: "Catch up on updates from founders, members and the wider ecosystem. Your home feed is the starting point for activity.",
    href: "/app",
    linkLabel: "View home feed",
  },
  {
    title: "Discover opportunities",
    description: "Explore people, services, startups and opportunities. Use search and filters to find what is relevant to you.",
    href: "/app/discover",
    linkLabel: "Explore discovery",
  },
  {
    title: "Messages and conversations",
    description: "Connect with other members, discuss opportunities and keep your conversations and Deal proposals together.",
    href: "/app/messages",
    linkLabel: "Open messages",
  },
  {
    title: "Your profile and settings",
    description: "Build your profile, manage your preferences and control how other members can find and contact you.",
    href: "/app/profile",
    linkLabel: "Open your profile",
  },
] as const;

export function FirstRunGuide({
  displayName,
  initiallyDismissed,
}: {
  displayName: string;
  initiallyDismissed: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  const [welcomeOpen, setWelcomeOpen] = useState(!initiallyDismissed);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function finishGuide() {
    setWelcomeOpen(false);
    setTourStep(null);
    setDismissed(true);
    startTransition(() => {
      void dismissFirstRunGuideAction().catch(() => {
        // The local UI stays usable; the welcome returns on the next session
        // if the server could not persist the dismissal.
      });
    });
  }

  function startTour() {
    setWelcomeOpen(false);
    setTourStep(0);
  }

  function openMessages() {
    finishGuide();
    router.push("/app/messages");
  }

  const step = tourStep === null ? null : GUIDE_STEPS[tourStep];

  return (
    <>
      <Dialog.Root
        open={welcomeOpen}
        onOpenChange={(open) => {
          if (!open) finishGuide();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-[2px]" />
          <Dialog.Content className="first-run-welcome fixed left-1/2 top-1/2 z-[71] grid max-h-[min(86dvh,42rem)] w-[min(30rem,calc(100vw-1.25rem))] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-3xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 text-[color:var(--px-text)] shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)]">
                <Compass aria-hidden size={25} />
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close welcome guide"
                  className="grid size-10 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus-visible:outline-2 focus-visible:outline-[color:var(--px-focus)]"
                  type="button"
                >
                  <X aria-hidden size={19} />
                </button>
              </Dialog.Close>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--px-primary)]">
                Welcome to PtahX
              </p>
              <Dialog.Title className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Good to have you here{displayName ? `, ${displayName.split(" ")[0]}` : ""}.
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
                Your workspace brings people, opportunities, conversations and
                agreements together. We can show you around in a short guide,
                or take you straight to Messages to start a conversation.
              </Dialog.Description>
            </div>

            <div className="grid gap-2 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4 text-sm">
              <p className="font-semibold">A quick map of your workspace</p>
              <div className="grid grid-cols-2 gap-3 text-[color:var(--px-text-muted)]">
                <span>• Home feed</span>
                <span>• Discover</span>
                <span>• Messages</span>
                <span>• Profile & settings</span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="w-full" onClick={startTour} type="button">
                Show me around <ArrowRight aria-hidden className="ml-2" size={16} />
              </Button>
              <Button
                className="w-full"
                onClick={openMessages}
                type="button"
                variant="secondary"
              >
                <MessageCircle aria-hidden className="mr-2" size={16} />
                Open Messages
              </Button>
            </div>
            <button
              className="min-h-11 justify-self-center px-3 text-sm font-semibold text-[color:var(--px-text-muted)] underline-offset-4 hover:text-[color:var(--px-text)] hover:underline"
              disabled={pending}
              onClick={finishGuide}
              type="button"
            >
              Explore on my own
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {step ? (
        <aside
          aria-label="PtahX guided tour"
          className="first-run-guide fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+0.75rem)] right-3 z-[65] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 text-[color:var(--px-text)] shadow-2xl sm:bottom-5 sm:right-5 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--px-primary)]">
              PtahX quick tour
            </span>
            <button
              aria-label="Close guide"
              className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)]"
              onClick={finishGuide}
              type="button"
            >
              <X aria-hidden size={17} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1.5" aria-label={`Step ${tourStep + 1} of ${GUIDE_STEPS.length}`}>
            {GUIDE_STEPS.map((item, index) => (
              <span
                aria-hidden="true"
                className={`h-1.5 flex-1 rounded-full ${index <= tourStep ? "bg-[color:var(--px-primary)]" : "bg-[color:var(--px-border)]"}`}
                key={item.title}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[color:var(--px-text-muted)]">
            STEP {tourStep + 1} OF {GUIDE_STEPS.length}
          </p>
          <h2 className="mt-1 text-lg font-bold">{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
            {step.description}
          </p>
          <Link
            className="mt-3 inline-flex min-h-10 items-center font-semibold text-sm text-[color:var(--px-primary)] underline-offset-4 hover:underline"
            href={step.href}
          >
            {step.linkLabel} <ArrowRight aria-hidden className="ml-1.5" size={15} />
          </Link>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[color:var(--px-border)] pt-3">
            <Button
              disabled={tourStep === 0}
              onClick={() => setTourStep((current) => Math.max(0, (current ?? 0) - 1))}
              size="sm"
              type="button"
              variant="secondary"
            >
              <ArrowLeft aria-hidden className="mr-1" size={15} /> Back
            </Button>
            {tourStep === GUIDE_STEPS.length - 1 ? (
              <Button onClick={finishGuide} size="sm" type="button">
                Finish <Check aria-hidden className="ml-1" size={15} />
              </Button>
            ) : (
              <Button
                onClick={() => setTourStep((current) => Math.min(GUIDE_STEPS.length - 1, (current ?? 0) + 1))}
                size="sm"
                type="button"
              >
                Next <ArrowRight aria-hidden className="ml-1" size={15} />
              </Button>
            )}
          </div>
        </aside>
      ) : dismissed ? (
        <button
          aria-label="Open PtahX guide"
          className="first-run-guide-launcher fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+0.75rem)] right-3 z-[64] inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 text-sm font-semibold text-[color:var(--px-text)] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:bottom-5 sm:right-5"
          onClick={() => setTourStep(0)}
          type="button"
        >
          <Compass aria-hidden size={17} /> Guide
        </button>
      ) : null}
    </>
  );
}
