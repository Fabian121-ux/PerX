"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, MonitorDown, Share2, Smartphone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  INSTALL_INITIAL_DELAY_MS,
  INSTALL_STATE_KEY,
  isAndroidBrowser,
  isInstallNudgeHome,
  isIOSBrowser,
  isStandaloneApp,
  parseLastInstallSuggestion,
  shouldAutoSuggestInstall,
} from "@/lib/pwa/install-policy";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallMode = "native" | "ios" | "android" | null;

function installed() {
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return isStandaloneApp({
    displayModeStandalone: displayMode,
    navigatorStandalone: nav.standalone,
  });
}

function readLastShown() {
  try {
    return parseLastInstallSuggestion(localStorage.getItem(INSTALL_STATE_KEY));
  } catch {
    return null;
  }
}
function markShown() {
  try {
    localStorage.setItem(INSTALL_STATE_KEY, String(Date.now()));
  } catch {
    // Install affordances are an enhancement; private browsing may block storage.
  }
}

/**
 * Install PtahX — only a real beforeinstallprompt event can start native
 * installation. iOS and non-eligible Android browsers get honest instructions.
 * No recurring timer/DB write. One delayed suggestion per 7 days on Home,
 * followed by an unobtrusive floating action until installation.
 */
export function InstallAppNudge() {
  const pathname = usePathname();
  const [offer, setOffer] = useState<InstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode>(null);
  const [isInstalled, setInstalled] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [hasSeenSuggestion, setHasSeenSuggestion] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    const updateInstalled = () => {
      if (!installed()) return;
      setInstalled(true);
      setOffer(null);
      setMode(null);
      setPopupOpen(false);
    };

    const onPrompt = (event: Event) => {
      if (installed()) return;
      event.preventDefault();
      setOffer(event as InstallPromptEvent);
      setMode("native");
    };
    const onInstalled = () => updateInstalled();
    const displayQuery = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayChanged = () => updateInstalled();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayQuery?.addEventListener?.("change", onDisplayChanged);
    // Defer environment detection until after hydration. Don't show an
    // install prompt to a user already running the installed PWA.
    const initial = window.setTimeout(() => {
      setHasSeenSuggestion(readLastShown() !== null);
      if (installed()) {
        updateInstalled();
        return;
      }
      const ua = navigator.userAgent;
      if (isIOSBrowser(ua, navigator.maxTouchPoints)) setMode("ios");
      else if (isAndroidBrowser(ua)) setMode((current) => current ?? "android");
    }, 0);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayQuery?.removeEventListener?.("change", onDisplayChanged);
    };
  }, []);

  useEffect(() => {
    if (!mode || isInstalled || !isInstallNudgeHome(pathname)) return;
    const timer = window.setTimeout(() => {
      if (shouldAutoSuggestInstall({
        isInstalled: installed(),
        isOnline: navigator.onLine,
        isEligible: true,
        isHomeScreen: isInstallNudgeHome(window.location.pathname),
        isVisible: document.visibilityState === "visible",
        lastShownAt: readLastShown(),
        now: Date.now(),
      })) {
        markShown();
        setHasSeenSuggestion(true);
        setPopupOpen(true);
      }
    }, INSTALL_INITIAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [mode, isInstalled, pathname]);

  async function requestInstall() {
    if (lockRef.current) return;
    if (mode !== "native" || !offer) {
      // iOS/Android: keep the instructional dialog open. Never fake success.
      setPopupOpen(true);
      return;
    }
    lockRef.current = true;
    setRequesting(true);
    setPopupOpen(false);
    try {
      await offer.prompt();
      const result = await offer.userChoice;
      setOffer(null); // A beforeinstallprompt event is one-shot.
      if (result.outcome === "accepted") {
        // Wait for appinstalled to confirm. Native install can still fail.
        setMode(isAndroidBrowser(navigator.userAgent) ? "android" : null);
      } else {
        setMode(isAndroidBrowser(navigator.userAgent) ? "android" : null);
      }
    } catch {
      setOffer(null);
      setMode(isAndroidBrowser(navigator.userAgent) ? "android" : null);
    } finally {
      lockRef.current = false;
      setRequesting(false);
    }
  }

  if (!mode || isInstalled) return null;

  const nativeInstall = mode === "native" && Boolean(offer);
  const actionLabel = nativeInstall ? "Install PtahX" : "How to install";
  return (
    <>
      {!popupOpen && hasSeenSuggestion ? (
        <button
          aria-label="Install PtahX app"
          className="fixed bottom-[calc(var(--mobile-nav-height,4.5rem)+env(safe-area-inset-bottom)+0.9rem)] right-3 z-[70] inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-[#164ec2] px-4 py-2 text-xs font-black text-white shadow-[0_10px_28px_rgba(8,25,61,0.32)] transition hover:bg-[#0b3b9c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:bottom-5"
          type="button"
          onClick={() => setPopupOpen(true)}
        >
          <Download aria-hidden size={18} /> Install app
        </button>
      ) : null}
      <Dialog.Root
        open={popupOpen}
        onOpenChange={(next) => {
          setPopupOpen(next);
          if (!next) markShown(); // Esc/overlay close also respects cooldown.
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#061936]/60 backdrop-blur-[2px]" />
          <Dialog.Content
            className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[101] max-h-[85dvh] overflow-y-auto rounded-[26px] border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] p-5 text-[color:var(--px-text)] shadow-[0_24px_70px_rgba(0,0,0,0.32)] focus:outline-none sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)]">
                <Smartphone aria-hidden size={25} />
              </div>
              <Dialog.Close asChild>
                <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-[color:var(--px-muted)]" type="button" aria-label="Close install suggestion">
                  <X aria-hidden size={20} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Title className="mt-4 text-xl font-black leading-7 text-[color:var(--px-text)]">
              Get a better PtahX experience
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Add PtahX to your home screen for quicker access, a full-screen app feel and an offline notice when your network drops.
              Messages and deals still need internet.
            </Dialog.Description>
            {!nativeInstall && (
              <div className="mt-4 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
                {mode === "ios" ? (
                  <p className="flex items-start gap-2 text-sm font-medium leading-6 text-[color:var(--px-text)]">
                    <Share2 aria-hidden size={20} className="mt-1 shrink-0 text-[color:var(--px-primary-ink)]" />
                    On iPhone or iPad, open PtahX in Safari, tap Share, then choose Add to Home Screen.
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-sm font-medium leading-6 text-[color:var(--px-text)]">
                    <MonitorDown aria-hidden size={20} className="mt-1 shrink-0 text-[color:var(--px-primary-ink)]" />
                    Open the browser menu (⋮) and choose Install app or Add to Home screen if available.
                  </p>
                )}
              </div>
            )}
            <div className="mt-5 grid gap-2">
              {nativeInstall ? (
                <button disabled={requesting} type="button" onClick={() => void requestInstall()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-black text-white disabled:opacity-60">
                  <Download aria-hidden size={18} /> {requesting ? "Opening install prompt..." : actionLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => { markShown(); setPopupOpen(false); }}
                className="min-h-11 rounded-xl border border-[color:var(--px-border-strong)] px-4 text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)]"
              >
                Maybe later
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-[color:var(--px-text-muted)]">
              Optional · Free · No app-store download needed
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
