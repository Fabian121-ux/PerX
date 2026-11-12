"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Truck,
  ChevronLeft,
  Compass,
  LifeBuoy,
  MessageCircle,
  Network,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { dismissOnboardingChecklistAction } from "@/features/onboarding/actions";

const STEPS = [
  {
    title: "Home",
    body: "You’re on Home. This is your main feed: share updates, follow what founders are building and keep up with activity across the startup ecosystem.",
    href: "/app",
    action: "Open Home",
    icon: Compass,
  },
  {
    title: "Discover",
    body: "Explore startups, opportunities, services and people. Use filters and search to find relevant openings and organisations.",
    href: "/app/discover",
    action: "Explore Discover",
    icon: Compass,
  },
  {
    title: "Connections",
    body: "Meet founders, potential clients, customers, co-founders and ecosystem partners. Send connection requests; once a request is accepted, you can message eligible members.",
    href: "/app/connections",
    action: "Open Connections",
    icon: Network,
  },
  {
    title: "Messages",
    body: "Continue conversations, ask questions and discuss possible collaborations. Deal and proposal actions are available from eligible conversations.",
    href: "/app/messages",
    action: "Open Messages",
    icon: MessageCircle,
  },
  {
    title: "Tracking Centre",
    body: "Track product agreements and delivery updates here. Product agreements appear automatically after a deal is created. Select a product agreement to check whether a verified courier update is available. An agreement status does not mean a parcel has shipped.",
    href: "/app/track",
    action: "Open Tracking Centre",
    icon: Truck,
  },
  {
    title: "Deals",
    body: "Review proposals, agreements and deal progress. The actions available depend on the opportunity and each participant’s permissions.",
    href: "/app/deals",
    action: "View Deals",
    icon: BriefcaseBusiness,
  },
  {
    title: "Support",
    body: "Need help with your account, a deal, payments or a platform issue? Open a request in the Service Center and follow its progress there.",
    href: "/app/service-center",
    action: "Open Service Center",
    icon: LifeBuoy,
  },
  {
    title: "Settings",
    body: "Manage your profile, security and preferences. Keep your account details current so important updates can reach you.",
    href: "/app/settings",
    action: "Open Settings",
    icon: Settings2,
  },
] as const;

function getCurrentStepIndex(pathname: string) {
  const index = STEPS.findIndex((step) =>
    step.href === "/app"
      ? pathname === "/app"
      : pathname === step.href || pathname.startsWith(`${step.href}/`),
  );
  return index >= 0 ? index : 0;
}


type SmartPageInfo = { title: string; body: string; action: string; href: string; hint: string };

function getSmartPageInfo(pathname: string, pageText: string, pageTitle: string): SmartPageInfo {
  const source = `${pathname} ${pageTitle} ${pageText}`.toLowerCase();
  const heading = pageText.split("\n").map((part) => part.trim()).find(Boolean);
  const routeName = pathname.split("/").filter(Boolean).at(-1)?.replace(/[-_]/g, " ");
  const label = (heading && heading.length < 70 ? heading : routeName || "this page")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const route = pathname.toLowerCase();
  const currentStatus = pageText.match(/(?:status|stage|state)[:\s]+([a-z _-]{3,40})/i)?.[1]?.trim();
  if (route === "/app/track" || route.startsWith("/app/track/") || /tracking centre|tracking center/.test(source)) return {
    title: "Tracking Centre",
    body: "This is your Tracking Centre. Your product agreements appear here automatically. Select an item to see its carrier update and delivery history. The agreement status is not the same as a courier update.",
    action: "Open Tracking Centre", href: "/app/track",
    hint: "Select a product agreement. Check the carrier, tracking number and latest update. If no carrier update is available, contact the seller or open a support request."
  };
  if (route.startsWith("/app/deals/") && route.endsWith("/deliveries")) return {
    title: "Deal deliveries",
    body: "This page is for submitting work or reviewing a delivery. If you are the provider, choose the open milestone, add a clear title and notes, then submit. If you are the client, review the submitted work before approving it.",
    action: "Back to Deal", href: route.slice(0, -"/deliveries".length),
    hint: currentStatus ? `Current status: ${currentStatus}. Check whether a delivery is waiting for your action.` : "Check whether you need to submit work or review a delivery."
  };
  if (route.startsWith("/app/deals/") && route.endsWith("/milestones")) return {
    title: "Deal milestones",
    body: "Milestones break the agreement into smaller pieces of work. Check each milestone, its description, amount and status so both sides know what is complete and what is next.",
    action: "Open Deal", href: route.slice(0, -"/milestones".length),
    hint: "Find the milestone marked in progress or awaiting review."
  };
  if (route.startsWith("/app/deals/") && route.endsWith("/escrow")) return {
    title: "Agreement timeline",
    body: "This page shows recorded agreement steps. It is not a wallet and does not mean money has been received or held. Check the latest status and its explanation.",
    action: "Open Deal", href: route.slice(0, -"/escrow".length),
    hint: "Review the recorded status and return to the Deal workspace for the next available action."
  };
  if (route.startsWith("/app/deals/")) return {
    title: "Deal workspace",
    body: "This is your Deal workspace. Check the agreed terms, progress and the next action shown on the page. You can open milestones, submit or review deliveries, and return to the discussion. PtahX does not hold funds.",
    action: "View all Deals", href: "/app/deals",
    hint: "Start with the next-action box. It tells you whether work is waiting to be submitted or reviewed."
  };
  if (/track|tracking|shipment|delivery|dispatch|logistics/.test(source)) return {
    title: "Tracking", body: "You’re on the tracking page. Check the latest status, review the timeline and open a tracking item for more details. If something looks delayed, use the available support option.", action: "View tracking", href: pathname, hint: "Check the latest update and tracking history."
  };
  if (/deal|proposal|agreement|contract|negotiat/.test(source)) return {
    title: "Deals", body: "You’re viewing a deal. Review the details, check the other party’s response and use the available actions to move it forward. Read the terms before you accept or make changes.", action: "Review this deal", href: pathname, hint: "Check the deal status and any action waiting for you."
  };
  if (/invoice|payment|payout|billing|transaction/.test(source)) return {
    title: "Payments", body: "You’re on a payments page. Check the amount, payment status and reference details. If a payment is pending, allow time for the status to update before trying again.", action: "View this page", href: pathname, hint: "Confirm the payment status and reference."
  };
  if (/opportunit|startup|founder|funding|grant|job|role/.test(source)) return {
    title: "Opportunities", body: "You’re exploring an opportunity. Read the requirements, check who can apply and follow the instructions on the page before submitting.", action: "View opportunity", href: pathname, hint: "Check the requirements and next steps."
  };
  if (/support|service.center|ticket|help.request/.test(source)) return {
    title: "Support", body: "You’re in the Support area. Open a request if you need help, then return here to check replies and updates.", action: "View support request", href: pathname, hint: "Check for a reply or update to your request."
  };
  if (/message|conversation|chat/.test(source)) return {
    title: "Messages", body: "You’re in Messages. Open a conversation to continue the discussion. You can discuss a possible deal with the other person when the relevant options are available.", action: "Open this page", href: pathname, hint: "Choose a conversation and check for new replies."
  };
  return {
    title: label, body: `You’re on ${label}. This guide reads the page title, headings and available actions to help you understand what to do here. Review the main information, then use the buttons on this page to continue. If you tell us what you expected to find, we can improve this guide.`,
    action: "Stay on this page", href: pathname, hint: "Start with the main heading and the primary button on this page."
  };
}

export function WelcomeGuide({ showWelcome }: { showWelcome: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const dismissedRef = useRef(!showWelcome);
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
  const [guideOpen, setGuideOpen] = useState(false);
  const [stepOverride, setStepOverride] = useState<number | null>(null);
  const [overridePath, setOverridePath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();


  const [pageText, setPageText] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  useEffect(() => {
    const readPage = () => {
      const main = document.querySelector("main") ?? document.body;
      const heading = main.querySelector("h1")?.textContent?.trim() || "";
      setPageTitle(document.title || "");
      const controls = Array.from(main.querySelectorAll("button, a, [role=button]")).map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 30).join(" | ");
      setPageText(`${heading}\n${(main.innerText || "").slice(0, 4500)}\nActions: ${controls}`);
    };
    readPage();
    const main = document.querySelector("main") ?? document.body;
    const observer = new MutationObserver(readPage);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);
  const smartPage = getSmartPageInfo(pathname, pageText, pageTitle);
  const knownPage = STEPS.some((item) => item.href === pathname || (item.href !== "/app" && pathname.startsWith(item.href + "/")));
  const currentStepIndex = getCurrentStepIndex(pathname);

  const activeStepIndex =
    overridePath === pathname && stepOverride !== null
      ? stepOverride
      : currentStepIndex;

  const step = knownPage ? STEPS[activeStepIndex] : {
    ...smartPage,
    icon: Compass,
  };


  const nextStep = STEPS[Math.min(STEPS.length - 1, activeStepIndex + 1)];

  const StepIcon = step.icon;

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
    setCollapsed(false);
    setGuideOpen(true);
    setOverridePath(pathname);
    setStepOverride(currentStepIndex);
  }

  function openGuide() {
    setCollapsed(false);
    setGuideOpen(true);
    setOverridePath(pathname);
    setStepOverride(currentStepIndex);
  }

  useEffect(() => {
    const handleOpenGuide = () => {
      setCollapsed(false);
      setGuideOpen(true);
      setOverridePath(pathname);
      setStepOverride(getCurrentStepIndex(pathname));
    };
    window.addEventListener("ptahx-open-guide", handleOpenGuide);
    return () => window.removeEventListener("ptahx-open-guide", handleOpenGuide);
  }, [pathname]);


  function openMessages() {
    closeWelcome();
    router.push("/app/messages");
  }

  function expandGuide() {
    setCollapsed(false);
    setGuideOpen(true);
    setOverridePath(pathname);
    setStepOverride(currentStepIndex);
  }

  function closeGuide() {
    setGuideOpen(false);
    setCollapsed(true);
    setStepOverride(null);
    setOverridePath(null);
  }

  function navigateWithGuide(href: string) {
    setStepOverride(null);
    setOverridePath(null);
    if (href !== pathname) return;
    setStepOverride(currentStepIndex);
    setOverridePath(pathname);
  }

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
                Welcome to PtahX
              </p>
              <Dialog.Title className="mt-2 text-2xl font-black leading-tight text-[color:var(--px-text)] sm:text-3xl">
                A good place to start.
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-7 text-[color:var(--px-text-muted)]">
                PtahX brings founders, startups and ecosystem opportunities into
                one place. Use the guide to understand the page you’re on and
                find a useful next step.
              </Dialog.Description>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-3">
                <Compass aria-hidden className="mt-0.5 shrink-0 text-[color:var(--px-primary-ink)]" size={19} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Explore</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Find people, startups and opportunities.</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3">
                <Network aria-hidden className="mt-0.5 shrink-0 text-[color:var(--px-primary-ink)]" size={19} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Build your network</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Connect with people and continue in Messages.</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 sm:col-span-2">
                <LifeBuoy aria-hidden className="mt-0.5 shrink-0 text-[color:var(--px-primary-ink)]" size={19} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Get support</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Use the Service Center whenever you need help.</p>
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

      {!welcomeOpen && collapsed ? (
        <button
          aria-label="Expand the getting started guide"
          className="fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+1rem)] right-0 z-[56] grid size-11 place-items-center rounded-l-xl border border-r-0 border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-primary-ink)] shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:bottom-6"
          onClick={expandGuide}
          title="Show guide"
          type="button"
        >
          <ChevronLeft aria-hidden size={21} />
        </button>
      ) : null}

      {!welcomeOpen && !collapsed && !guideOpen ? (
        <button
          aria-label="Open the PtahX getting started guide"
          className="ptahx-guide-launcher fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+1rem)] right-4 z-[55] inline-flex min-h-11 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-3 text-sm font-bold text-[color:var(--px-text)] shadow-xl transition hover:-translate-y-0.5 hover:border-[color:var(--px-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:bottom-6 lg:right-6"
          onClick={openGuide}
          type="button"
        >
          <Compass aria-hidden className="shrink-0 text-[color:var(--px-primary-ink)]" size={18} />
          Guide
        </button>
      ) : null}

      {!welcomeOpen && !collapsed && guideOpen ? (
        <section
          aria-label="PtahX getting started guide"
          aria-live="polite"
          className="ptahx-guide-card fixed bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+1rem)] right-3 z-[56] grid max-h-[min(62dvh,30rem)] w-[min(23rem,calc(100vw-1.5rem))] gap-4 overflow-y-auto rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 text-[color:var(--px-text)] shadow-2xl sm:right-5 sm:p-5 lg:bottom-6 lg:right-6"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--px-primary-ink)]">
              {knownPage ? `Page guide · ${activeStepIndex + 1} of ${STEPS.length}` : "Page guide · This page"}
            </p>
            <button
              aria-label="Tuck guide into corner"
              title="Hide guide"
              className="grid size-10 shrink-0 place-items-center rounded-lg text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              onClick={closeGuide}
              type="button"
            >
              <X aria-hidden size={18} />
            </button>
          </div>

          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)]">
              <StepIcon aria-hidden size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--px-text-muted)]">
                You’re on this page
              </p>
              <h2 className="mt-0.5 break-words text-base font-extrabold [overflow-wrap:anywhere]">
                {step.title}
              </h2>
              <p className="mt-1 break-words text-sm leading-6 text-[color:var(--px-text-muted)] [overflow-wrap:anywhere]">
                {step.body}
              </p>
            </div>
          </div>

          {knownPage ? (
            <>
              {activeStepIndex < STEPS.length - 1 ? (
                <p className="break-words text-sm leading-6 text-[color:var(--px-text-muted)]">
                  Next, go to{" "}
                  <Link className="font-bold text-[color:var(--px-primary-ink)] underline underline-offset-2 hover:no-underline" href={nextStep.href} onClick={() => navigateWithGuide(nextStep.href)}>
                    {nextStep.title}
                  </Link>{" "}
                  to continue exploring PtahX.
                </p>
              ) : (
                <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">You’ve reached the end of the guide. You can reopen it whenever you need help.</p>
              )}
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--px-surface-soft)]">
                <div className="h-full rounded-full bg-[color:var(--px-primary)] transition-[width] duration-200" style={{ width: `${((activeStepIndex + 1) / STEPS.length) * 100}%` }} />
              </div>
            </>
          ) : (
            <p className="break-words text-sm leading-6 text-[color:var(--px-text-muted)]">
              <span className="font-semibold text-[color:var(--px-text)]">Try this:</span> {smartPage.hint}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {knownPage ? (
              <button className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] disabled:opacity-40" disabled={activeStepIndex === 0} onClick={() => { setOverridePath(pathname); setStepOverride(Math.max(0, activeStepIndex - 1)); }} type="button">
                <ArrowLeft aria-hidden size={16} /> Back
              </button>
            ) : <span className="text-xs text-[color:var(--px-text-muted)]">Page-aware help</span>}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--px-primary-ink)] hover:bg-[color:var(--px-primary-soft)]" href={step.href} onClick={() => navigateWithGuide(step.href)}>
                {step.action}
              </Link>
              {knownPage && activeStepIndex < STEPS.length - 1 ? (
                <Button onClick={() => { setOverridePath(pathname); setStepOverride(Math.min(STEPS.length - 1, activeStepIndex + 1)); }} size="sm" type="button">
                  Next <ArrowRight aria-hidden className="ml-1" size={15} />
                </Button>
              ) : (
                <Button onClick={closeGuide} size="sm" type="button">{knownPage ? "Finish" : "Got it"}</Button>
              )}
            </div>
          </div>

        </section>
      ) : null}
    </>
  );
}
