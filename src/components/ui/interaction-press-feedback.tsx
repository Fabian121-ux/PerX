"use client";

import { useEffect } from "react";

/**
 * Immediate, short touch/keyboard acknowledgement for existing interactive
 * elements. Uses one delegated listener, not one React state per feed card.
 *
 * This does not alter clicks, form handlers or navigation. Preventing repeat
 * *submissions* is handled by useFormStatus on submit buttons; otherwise
 * deliberately repeatable controls (carousel, tabs, chat) must stay usable.
 */
export function InteractionPressFeedback() {
  useEffect(() => {
    const activeTimers = new Map<HTMLElement, number>();

    function pulse(target: EventTarget | null) {
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        "button, a[href], [role='button']",
      );
      if (
        !control ||
        control.matches(":disabled, [aria-disabled='true']") ||
        control.closest("[inert]")
      ) return;

      const previous = activeTimers.get(control);
      if (previous !== undefined) window.clearTimeout(previous);
      control.dataset.ptahxPressed = "true";
      activeTimers.set(control, window.setTimeout(() => {
        control.removeAttribute("data-ptahx-pressed");
        activeTimers.delete(control);
      }, 260));
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pulse(event.target);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      pulse(event.target);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      for (const [element, timeout] of activeTimers) {
        window.clearTimeout(timeout);
        element.removeAttribute("data-ptahx-pressed");
      }
      activeTimers.clear();
    };
  }, []);

  return null;
}
