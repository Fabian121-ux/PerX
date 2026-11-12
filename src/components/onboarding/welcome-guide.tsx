"use client";

import { MousePointer2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { dismissOnboardingChecklistAction } from "@/features/onboarding/actions";

type TargetPosition = {
  left: number;
  top: number;
  pointerLeft: number;
  pointerTop: number;
};

export function WelcomeGuide({ showWelcome }: { showWelcome: boolean }) {
  const pathname = usePathname();
  const dismissedRef = useRef(!showWelcome);
  const [hintVisible, setHintVisible] = useState(showWelcome);
  const [targetPosition, setTargetPosition] = useState<TargetPosition | null>(
    null,
  );

  const dismissHint = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setHintVisible(false);
    setTargetPosition(null);
    void dismissOnboardingChecklistAction().catch(() => {
      // The hint can be shown again on the next visit if saving dismissal fails.
      dismissedRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!showWelcome) return;

    if (pathname === "/app/news") {
      dismissHint();
      return;
    }

  }, [dismissHint, pathname, showWelcome]);

  useEffect(() => {
    if (!hintVisible || pathname === "/app/news") return;

    let frame = 0;
    let secondFrame = 0;

    const updateTarget = () => {
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-onboarding-news-target='true']",
        ),
      );
      const target = targets.find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      });

      if (!target) {
        setTargetPosition(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const bubbleWidth = Math.min(260, window.innerWidth - 24);
      const left = Math.max(
        12,
        Math.min(window.innerWidth - bubbleWidth - 12, centerX - bubbleWidth / 2),
      );
      const top = Math.min(
        window.innerHeight - 116,
        rect.bottom + 18,
      );

      setTargetPosition({
        left,
        top,
        pointerLeft: Math.max(8, Math.min(window.innerWidth - 36, centerX - 14)),
        pointerTop: Math.max(8, rect.bottom - 15),
      });
    };

    frame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(updateTarget);
    });
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [hintVisible, pathname]);

  if (!hintVisible || !showWelcome || pathname === "/app/news" || !targetPosition) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-[75]">
      <MousePointer2
        aria-hidden
        className="absolute h-9 w-9 motion-safe:animate-bounce fill-[color:var(--px-primary)] text-white drop-shadow-[0_3px_5px_rgba(15,23,42,0.5)]"
        size={36}
        style={{
          left: targetPosition.pointerLeft,
          top: targetPosition.pointerTop,
          transform: "rotate(-12deg)",
        }}
      />
      <div
        className="pointer-events-auto absolute w-[min(260px,calc(100vw-24px))] rounded-2xl border border-[color:var(--px-primary)]/30 bg-[color:var(--px-surface)] p-3.5 text-[color:var(--px-text)] shadow-[0_16px_44px_rgba(15,23,42,0.24)]"
        role="status"
        style={{ left: targetPosition.left, top: targetPosition.top }}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)]">
            <MousePointer2 aria-hidden size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Your welcome message is waiting</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
              Tap <strong>News</strong> to read your personal welcome message from preX.
            </p>
          </div>
          <button
            aria-label="Dismiss welcome hint"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            onClick={dismissHint}
            type="button"
          >
            <X aria-hidden size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
