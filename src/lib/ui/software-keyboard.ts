/**
 * Software-keyboard detection primitives.
 *
 * Pure, DOM-free logic so the decision rules can be unit tested without a
 * browser. The React binding lives in
 * `src/components/layout/software-keyboard-provider.tsx`.
 *
 * ---------------------------------------------------------------------------
 * Why this is not just `visualViewport.height`
 * ---------------------------------------------------------------------------
 * The two mobile platforms behave differently, and the app opts into
 * `interactiveWidget: "resizes-content"` in the root viewport export:
 *
 *  iOS Safari / WebKit
 *    The layout viewport (`window.innerHeight`) stays the same and only the
 *    visual viewport shrinks. `layoutHeight - (viewportHeight + offsetTop)`
 *    therefore yields the real keyboard height.
 *
 *  Android Chrome with `resizes-content`
 *    The *layout* viewport itself shrinks to the area above the keyboard, so
 *    `visualViewport.height` tracks `window.innerHeight` and the computed
 *    inset is ~0 even though the keyboard is very much open. Anything fixed to
 *    the bottom is re-anchored directly above the keyboard - which is exactly
 *    the reported "bottom nav sits on top of the keyboard" defect.
 *
 * So viewport geometry alone cannot answer "is the keyboard open?". The
 * authoritative cross-platform signal is "an editable element holds focus on a
 * device that uses an on-screen keyboard". Viewport geometry is then used as
 * corroboration and, when available, to report the actual keyboard height for
 * components that need to sit directly above it.
 */

/** Minimum visual-viewport shrink (px) treated as a real keyboard, not chrome. */
export const KEYBOARD_MIN_INSET = 96;

/**
 * Minimum layout-viewport shrink (px) relative to the resting baseline that is
 * treated as an `resizes-content` keyboard. Deliberately larger than
 * `KEYBOARD_MIN_INSET` because collapsing browser toolbars also shrink the
 * layout viewport by ~60-80px during scroll.
 */
export const KEYBOARD_MIN_LAYOUT_SHRINK = 120;

/** Below this width the authenticated bottom navigation is rendered (`lg:hidden`). */
export const MOBILE_NAV_MAX_WIDTH = 1024;

export type KeyboardViewportSample = {
  /** `window.innerHeight` - the layout viewport. */
  layoutHeight: number;
  /** Largest `layoutHeight` observed while no editable element was focused. */
  layoutBaseline: number;
  /** `visualViewport.height`, or `null` when the API is unavailable. */
  viewportHeight: number | null;
  /** `visualViewport.offsetTop`. */
  offsetTop: number;
  /** An element that summons an on-screen keyboard currently holds focus. */
  editableFocused: boolean;
  /** `window.innerWidth`. */
  viewportWidth: number;
  /** The device uses an on-screen keyboard (coarse pointer / touch). */
  touchCapable: boolean;
};

export type KeyboardState = {
  /** Suppress bottom navigation and other bottom-anchored chrome. */
  open: boolean;
  /**
   * Measured keyboard height in CSS pixels.
   *
   * Non-zero only where the platform actually overlays the keyboard on the
   * layout viewport (iOS). On `resizes-content` platforms the layout has
   * already been resized, so `0` is correct - callers must not add extra
   * padding there or content is pushed twice.
   */
  inset: number;
};

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export type EditableCandidate = {
  tagName: string;
  type?: string | null;
  readOnly?: boolean;
  disabled?: boolean;
  isContentEditable?: boolean;
};

/**
 * True when focusing this element would summon an on-screen keyboard.
 *
 * Excludes read-only/disabled fields and non-text input types (checkbox,
 * radio, file, submit, ...) which take focus without opening a keyboard, and
 * would otherwise cause the navigation to vanish for no reason.
 */
export function isKeyboardEditable(
  element: EditableCandidate | null | undefined,
): boolean {
  if (!element) return false;
  if (element.disabled) return false;

  if (element.isContentEditable) return true;

  const tag = element.tagName?.toUpperCase();

  if (tag === "TEXTAREA") return !element.readOnly;

  if (tag === "INPUT") {
    if (element.readOnly) return false;
    const type = (element.type ?? "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }

  // <select> opens a native picker rather than a keyboard, and the picker does
  // not reflow the viewport. Treated as non-editable on purpose.
  return false;
}

/**
 * Keyboard height derived purely from visual-viewport geometry.
 * Returns 0 when the API is unavailable or the shrink is below the noise floor.
 */
export function resolveVisualViewportInset(
  sample: Pick<
    KeyboardViewportSample,
    "layoutHeight" | "viewportHeight" | "offsetTop"
  >,
): number {
  if (sample.viewportHeight === null) return 0;

  const inset = Math.round(
    sample.layoutHeight - (sample.viewportHeight + sample.offsetTop),
  );

  return inset >= KEYBOARD_MIN_INSET ? inset : 0;
}

/**
 * Resolves the software-keyboard state for a single observation.
 *
 * Decision order:
 *  1. Desktop-width viewports never suppress navigation - the bottom bar is
 *     not rendered there and a hardware keyboard must not affect layout.
 *  2. A measurable visual-viewport shrink is conclusive (iOS), and also covers
 *     the case where focus moved into a same-origin iframe we cannot inspect.
 *  3. Otherwise an editable element holding focus on a touch-capable device
 *     means the keyboard is open. This is the `resizes-content` Android path
 *     and the only reliable signal there.
 *  4. A layout-viewport shrink below the resting baseline corroborates (3) and
 *     guards against stale focus after the user dismisses the keyboard with
 *     the hardware back gesture, which fires no blur event.
 */
export function resolveKeyboardState(
  sample: KeyboardViewportSample,
): KeyboardState {
  if (sample.viewportWidth >= MOBILE_NAV_MAX_WIDTH) {
    return { inset: 0, open: false };
  }

  const visualInset = resolveVisualViewportInset(sample);
  if (visualInset > 0) {
    return { inset: visualInset, open: true };
  }

  if (!sample.editableFocused) {
    return { inset: 0, open: false };
  }

  if (!sample.touchCapable) {
    // Hardware keyboard (desktop browser in a narrow window, emulator). Typing
    // there does not occlude anything, so leave navigation in place.
    return { inset: 0, open: false };
  }

  const layoutShrink = sample.layoutBaseline - sample.layoutHeight;
  if (layoutShrink >= KEYBOARD_MIN_LAYOUT_SHRINK) {
    // `resizes-content`: the layout is already inset above the keyboard, so
    // report 0 to avoid double-padding, but the keyboard is open.
    return { inset: 0, open: true };
  }

  // Focused editable on a touch device with no measurable reflow yet. This is
  // the frame between focus and the keyboard animation completing; treat it as
  // open so navigation never flashes over the rising keyboard.
  return { inset: 0, open: true };
}
