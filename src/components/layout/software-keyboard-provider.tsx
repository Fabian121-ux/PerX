"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  isKeyboardEditable,
  resolveKeyboardState,
  type KeyboardState,
} from "@/lib/ui/software-keyboard";

const SoftwareKeyboardContext = createContext<KeyboardState>({
  inset: 0,
  open: false,
});

/**
 * Read the current software-keyboard state.
 *
 * `open` is the app-wide signal that bottom-anchored chrome (primary
 * navigation, floating actions, toasts) must get out of the way.
 * `inset` is the measured keyboard height, which is non-zero only on
 * platforms that overlay the keyboard instead of resizing the layout.
 */
export function useSoftwareKeyboard(): KeyboardState {
  return useContext(SoftwareKeyboardContext);
}

/**
 * App-shell-level software keyboard observer.
 *
 * Replaces the previous messaging-only workaround: any route with a text
 * input - Messages, Comments, Search, Create Post, Profile editing, arbitrary
 * forms - now suppresses the bottom navigation while the keyboard is open,
 * because the signal is derived from focus + viewport rather than from a
 * hardcoded pathname.
 *
 * Publishes state three ways so both React and plain CSS can consume it:
 *  - context, for components that need the numeric inset
 *  - `data-perx-keyboard="open"` on <html>, for CSS-only rules
 *  - `--px-keyboard-inset` custom property, for `calc()` in stylesheets
 */
export function SoftwareKeyboardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<KeyboardState>({ inset: 0, open: false });

  // Largest layout height seen while nothing editable was focused. Used to
  // detect `resizes-content` shrink. Kept in a ref so re-measuring never
  // schedules a render on its own.
  const layoutBaselineRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const active = document.activeElement as
      | (HTMLElement & { readOnly?: boolean; disabled?: boolean; type?: string })
      | null;

    const editableFocused = isKeyboardEditable(
      active
        ? {
            disabled: Boolean(active.disabled),
            isContentEditable: active.isContentEditable,
            readOnly: Boolean(active.readOnly),
            tagName: active.tagName,
            type: active.type,
          }
        : null,
    );

    const layoutHeight = window.innerHeight;

    // Only grow the baseline while the keyboard is definitely closed,
    // otherwise a keyboard-shrunk viewport would become the new "resting"
    // height and permanently defeat the shrink comparison.
    if (!editableFocused && layoutHeight > layoutBaselineRef.current) {
      layoutBaselineRef.current = layoutHeight;
    }

    const viewport = window.visualViewport;
    const next = resolveKeyboardState({
      editableFocused,
      layoutBaseline: layoutBaselineRef.current || layoutHeight,
      layoutHeight,
      offsetTop: viewport?.offsetTop ?? 0,
      touchCapable:
        typeof window.matchMedia === "function"
          ? window.matchMedia("(pointer: coarse)").matches ||
            navigator.maxTouchPoints > 0
          : navigator.maxTouchPoints > 0,
      viewportHeight: viewport?.height ?? null,
      viewportWidth: window.innerWidth,
    });

    setState((current) =>
      current.open === next.open && current.inset === next.inset
        ? current
        : next,
    );
  }, []);

  // Coalesce the burst of focus/resize/scroll events the keyboard animation
  // produces into one measurement per frame.
  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    measure();

    const viewport = window.visualViewport;

    // `focusin`/`focusout` bubble, so a single document listener covers every
    // input in the tree, including ones mounted later in portals.
    document.addEventListener("focusin", scheduleMeasure);
    document.addEventListener("focusout", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    viewport?.addEventListener("resize", scheduleMeasure);
    // iOS shifts the visual viewport without resizing it when the user scrolls
    // with the keyboard open.
    viewport?.addEventListener("scroll", scheduleMeasure);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      document.removeEventListener("focusin", scheduleMeasure);
      document.removeEventListener("focusout", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [measure, scheduleMeasure]);

  // Mirror onto <html> so stylesheets can react without prop drilling.
  useEffect(() => {
    const root = document.documentElement;
    if (state.open) {
      root.dataset.perxKeyboard = "open";
    } else {
      delete root.dataset.perxKeyboard;
    }
    root.style.setProperty("--px-keyboard-inset", `${state.inset}px`);

    return () => {
      delete root.dataset.perxKeyboard;
      root.style.removeProperty("--px-keyboard-inset");
    };
  }, [state.inset, state.open]);

  const value = useMemo(
    () => ({ inset: state.inset, open: state.open }),
    [state.inset, state.open],
  );

  return (
    <SoftwareKeyboardContext.Provider value={value}>
      {children}
    </SoftwareKeyboardContext.Provider>
  );
}
