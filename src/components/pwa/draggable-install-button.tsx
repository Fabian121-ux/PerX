"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A genuinely draggable, compact PWA affordance. Coordinates are browser-local,
 * clamped to the visible viewport on resize, and never uploaded.
 */
export const INSTALL_FAB_POSITION_KEY = "ptahx:pwa-fab-position:v1";
const SIZE = 54;
const EDGE = 12;
const TOP_CLEARANCE = 112;
const BOTTOM_CLEARANCE = 108;
const DRAG_THRESHOLD = 7;
const SCROLL_IDLE_MS = 850;

/** Inputs, editors and soft-keyboard surfaces must never be obscured by the
 * install shortcut. Dialogs use their own backdrop and should not compete
 * with another floating control. */
export function isInstallFabObscuredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']",
  ));
}
type Position = { x: number; y: number };

export function clampInstallFabPosition(position: Position, width: number, height: number): Position {
  return {
    x: Math.max(EDGE, Math.min(Math.max(EDGE, width - SIZE - EDGE), position.x)),
    y: Math.max(EDGE, Math.min(Math.max(EDGE, height - SIZE - BOTTOM_CLEARANCE), Math.max(Math.min(TOP_CLEARANCE, height - SIZE - EDGE), position.y))),
  };
}

function firstPosition(): Position {
  const width = window.innerWidth;
  const height = window.innerHeight;
  try {
    const saved = JSON.parse(localStorage.getItem(INSTALL_FAB_POSITION_KEY) || "null") as unknown;
    if (saved && typeof saved === "object" && "x" in saved && "y" in saved &&
      typeof saved.x === "number" && typeof saved.y === "number" &&
      Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return clampInstallFabPosition({ x: Number(saved.x), y: Number(saved.y) }, width, height);
    }
  } catch {
    // Storage can be blocked or malformed; fall back to the edge.
  }
  return clampInstallFabPosition({ x: width - SIZE - EDGE, y: height * 0.38 }, width, height);
}

export function DraggableInstallButton({ onOpen }: { onOpen: () => void }) {
  const [position, setPosition] = useState<Position | null>(null);
  const posRef = useRef<Position | null>(null);
  const dragging = useRef<{ pointerId: number; x: number; y: number; origin: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [editing, setEditing] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  const move = (next: Position, save: boolean) => {
    const clamped = clampInstallFabPosition(next, window.innerWidth, window.innerHeight);
    posRef.current = clamped;
    setPosition(clamped);
    if (save) {
      try { localStorage.setItem(INSTALL_FAB_POSITION_KEY, JSON.stringify(clamped)); } catch { /* local only */ }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => move(firstPosition(), false), 0);
    const onResize = () => {
      // Browser chrome, orientation and soft-keyboard resizes only affect the
      // visible position, not the user's persisted preference.
      if (posRef.current) move(posRef.current, false);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const updateEditing = () => setEditing(
      isInstallFabObscuredTarget(document.activeElement),
    );
    const onFocusIn = () => {
      if (blurTimer) clearTimeout(blurTimer);
      updateEditing();
    };
    const onFocusOut = () => {
      if (blurTimer) clearTimeout(blurTimer);
      // Wait until focus moves to the next element. This avoids exposing the
      // floating button between two form fields.
      blurTimer = setTimeout(updateEditing, 0);
    };
    const onScroll = () => {
      setScrolling(true);
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => setScrolling(false), SCROLL_IDLE_MS);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", onScroll, true);
    const initialTimer = setTimeout(updateEditing, 0);
    return () => {
      clearTimeout(initialTimer);
      if (blurTimer) clearTimeout(blurTimer);
      if (scrollTimer) clearTimeout(scrollTimer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // The user's saved position is never removed while typing or scrolling.
  // Hide rather than move it over a keyboard or feed text being read.
  if (editing || scrolling) return null;

  return (
    <button
      aria-label="Install PtahX app. Drag to reposition"
      className="ptahx-pwa-fab fixed z-[70] grid h-[54px] w-[54px] place-items-center rounded-full border-2 border-white/70 bg-[#1558d4] text-white shadow-[0_8px_24px_rgba(8,25,61,0.4)] outline-none transition-[box-shadow,background-color] hover:bg-[#0a469f] focus-visible:ring-4 focus-visible:ring-amber-400"
      type="button"
      title="Install PtahX — drag to move"
      style={{ left: position?.x ?? -100, top: position?.y ?? -100, touchAction: "none", visibility: position ? "visible" : "hidden" }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !posRef.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = {
          pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          origin: posRef.current, moved: false,
        };
      }}
      onPointerMove={(event) => {
        const start = dragging.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) start.moved = true;
        if (start.moved) move({ x: start.origin.x + dx, y: start.origin.y + dy }, false);
      }}
      onPointerUp={(event) => {
        const start = dragging.current;
        if (!start || start.pointerId !== event.pointerId) return;
        if (start.moved) {
          suppressClick.current = true;
          if (posRef.current) move(posRef.current, true);
        }
        dragging.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { dragging.current = null; }}
      onClick={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        if (!posRef.current || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 48 : 20;
        const delta = event.key === "ArrowUp" ? { x: 0, y: -step } :
          event.key === "ArrowDown" ? { x: 0, y: step } :
          event.key === "ArrowLeft" ? { x: -step, y: 0 } : { x: step, y: 0 };
        move({ x: posRef.current.x + delta.x, y: posRef.current.y + delta.y }, true);
      }}
    >
      <Download size={23} aria-hidden />
    </button>
  );
}
