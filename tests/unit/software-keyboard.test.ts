import { describe, expect, it } from "vitest";

import {
  KEYBOARD_MIN_INSET,
  isKeyboardEditable,
  resolveKeyboardState,
  resolveVisualViewportInset,
  type KeyboardViewportSample,
} from "@/lib/ui/software-keyboard";

/** A phone-sized, touch-capable device with nothing focused and no keyboard. */
function baseSample(
  overrides: Partial<KeyboardViewportSample> = {},
): KeyboardViewportSample {
  return {
    editableFocused: false,
    layoutBaseline: 844,
    layoutHeight: 844,
    offsetTop: 0,
    touchCapable: true,
    viewportHeight: 844,
    viewportWidth: 390,
    ...overrides,
  };
}

describe("isKeyboardEditable", () => {
  it("treats text inputs, textareas, and contenteditable as keyboard triggers", () => {
    expect(isKeyboardEditable({ tagName: "TEXTAREA" })).toBe(true);
    expect(isKeyboardEditable({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isKeyboardEditable({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(isKeyboardEditable({ tagName: "INPUT", type: "email" })).toBe(true);
    expect(isKeyboardEditable({ tagName: "INPUT" })).toBe(true);
    expect(
      isKeyboardEditable({ isContentEditable: true, tagName: "DIV" }),
    ).toBe(true);
  });

  it("ignores focusable elements that never summon a keyboard", () => {
    expect(isKeyboardEditable(null)).toBe(false);
    expect(isKeyboardEditable({ tagName: "BUTTON" })).toBe(false);
    expect(isKeyboardEditable({ tagName: "A" })).toBe(false);
    expect(isKeyboardEditable({ tagName: "SELECT" })).toBe(false);
    expect(isKeyboardEditable({ tagName: "INPUT", type: "checkbox" })).toBe(
      false,
    );
    expect(isKeyboardEditable({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(isKeyboardEditable({ tagName: "INPUT", type: "file" })).toBe(false);
    expect(isKeyboardEditable({ tagName: "INPUT", type: "submit" })).toBe(
      false,
    );
  });

  it("ignores read-only and disabled fields", () => {
    expect(
      isKeyboardEditable({ readOnly: true, tagName: "INPUT", type: "text" }),
    ).toBe(false);
    expect(isKeyboardEditable({ readOnly: true, tagName: "TEXTAREA" })).toBe(
      false,
    );
    expect(
      isKeyboardEditable({ disabled: true, tagName: "INPUT", type: "text" }),
    ).toBe(false);
    expect(
      isKeyboardEditable({ disabled: true, isContentEditable: true, tagName: "DIV" }),
    ).toBe(false);
  });
});

describe("resolveVisualViewportInset", () => {
  it("reports the overlay height when the visual viewport shrinks", () => {
    expect(
      resolveVisualViewportInset({
        layoutHeight: 844,
        offsetTop: 0,
        viewportHeight: 508,
      }),
    ).toBe(336);
  });

  it("ignores shrink below the noise floor so browser chrome is not mistaken for a keyboard", () => {
    expect(
      resolveVisualViewportInset({
        layoutHeight: 844,
        offsetTop: 0,
        viewportHeight: 844 - (KEYBOARD_MIN_INSET - 1),
      }),
    ).toBe(0);
  });

  it("accounts for a scrolled visual viewport offset", () => {
    expect(
      resolveVisualViewportInset({
        layoutHeight: 844,
        offsetTop: 60,
        viewportHeight: 508,
      }),
    ).toBe(276);
  });

  it("returns zero when visualViewport is unavailable", () => {
    expect(
      resolveVisualViewportInset({
        layoutHeight: 844,
        offsetTop: 0,
        viewportHeight: null,
      }),
    ).toBe(0);
  });
});

describe("resolveKeyboardState", () => {
  it("reports closed at rest", () => {
    expect(resolveKeyboardState(baseSample())).toEqual({
      inset: 0,
      open: false,
    });
  });

  it("detects the iOS overlay keyboard from viewport geometry alone", () => {
    // iOS keeps the layout viewport at full height and only shrinks the
    // visual viewport, so the inset is the real keyboard height.
    expect(
      resolveKeyboardState(
        baseSample({ editableFocused: true, viewportHeight: 508 }),
      ),
    ).toEqual({ inset: 336, open: true });
  });

  it("detects the keyboard on Android resizes-content where the inset measures zero", () => {
    // The layout viewport itself shrank, so visualViewport.height tracks
    // innerHeight and geometry reports no inset - focus is the only signal.
    const state = resolveKeyboardState(
      baseSample({
        editableFocused: true,
        layoutBaseline: 844,
        layoutHeight: 480,
        viewportHeight: 480,
      }),
    );

    expect(state.open).toBe(true);
    // Must stay 0: the layout is already inset, extra padding would double up.
    expect(state.inset).toBe(0);
  });

  it("treats a focused editable on touch as open even before the viewport reflows", () => {
    // The frame between focusin and the keyboard animation completing.
    expect(
      resolveKeyboardState(baseSample({ editableFocused: true })),
    ).toEqual({ inset: 0, open: true });
  });

  it("never suppresses navigation on desktop-width viewports", () => {
    // The bottom bar is lg:hidden; a hardware keyboard must not move layout.
    expect(
      resolveKeyboardState(
        baseSample({
          editableFocused: true,
          viewportHeight: 400,
          viewportWidth: 1280,
        }),
      ),
    ).toEqual({ inset: 0, open: false });
  });

  it("ignores hardware keyboards on non-touch narrow windows", () => {
    expect(
      resolveKeyboardState(
        baseSample({ editableFocused: true, touchCapable: false }),
      ),
    ).toEqual({ inset: 0, open: false });
  });

  it("stays closed when a non-editable element is focused", () => {
    expect(
      resolveKeyboardState(baseSample({ editableFocused: false })),
    ).toEqual({ inset: 0, open: false });
  });

  it("reports open from geometry even when focus is not observable", () => {
    // Focus inside an iframe or a shadow root we cannot inspect: the measured
    // shrink still proves the keyboard is up.
    expect(
      resolveKeyboardState(
        baseSample({ editableFocused: false, viewportHeight: 508 }),
      ),
    ).toEqual({ inset: 336, open: true });
  });
});
