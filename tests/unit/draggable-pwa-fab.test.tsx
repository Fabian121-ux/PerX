// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampInstallFabPosition,
  DraggableInstallButton,
  INSTALL_FAB_POSITION_KEY,
  isInstallFabObscuredTarget,
} from "@/components/pwa/draggable-install-button";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe("small draggable PtahX PWA install affordance", () => {
  it("never starts inside the bottom navigation or outside the phone viewport", () => {
    expect(clampInstallFabPosition({ x: 9000, y: 9000 }, 390, 844)).toEqual({ x: 324, y: 682 });
    expect(clampInstallFabPosition({ x: -400, y: -400 }, 390, 844)).toEqual({ x: 12, y: 112 });
    const narrow = clampInstallFabPosition({ x: 0, y: 0 }, 320, 320);
    expect(narrow.x).toBeGreaterThanOrEqual(12);
    expect(narrow.y).toBeGreaterThanOrEqual(12);
    expect(narrow.y).toBeLessThanOrEqual(320 - 54 - 12);
  });

  it("renders as a circle with a functional install action", () => {
    const onOpen = vi.fn();
    render(<DraggableInstallButton onOpen={onOpen} />);
    act(() => vi.advanceTimersByTime(0));
    const btn = screen.getByRole("button", { name: /Install PtahX app/ });
    expect(btn.className).toContain("rounded-full");
    expect(btn.className).toContain("h-[54px]");
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("supports accessible arrow-key repositioning and saves coordinates locally", () => {
    const onOpen = vi.fn();
    render(<DraggableInstallButton onOpen={onOpen} />);
    act(() => vi.advanceTimersByTime(0));
    const btn = screen.getByRole("button", { name: /Install PtahX app/ });
    const x = Number.parseFloat(btn.style.left);
    fireEvent.keyDown(btn, { key: "ArrowLeft" });
    expect(Number.parseFloat(btn.style.left)).toBe(x - 20);
    expect(JSON.parse(localStorage.getItem(INSTALL_FAB_POSITION_KEY) || "{}")).toHaveProperty("x", x - 20);
    expect(onOpen).not.toHaveBeenCalled();
  });
  it("hides while editing any text field, then restores the draggable shortcut", () => {
    const onOpen = vi.fn();
    render(
      <>
        <input aria-label="Search people" />
        <textarea aria-label="Write a post" />
        <div role="textbox" tabIndex={0} aria-label="Compose rich text" />
        <DraggableInstallButton onOpen={onOpen} />
      </>,
    );
    act(() => vi.advanceTimersByTime(0));
    const fab = () => screen.queryByRole("button", { name: /Install PtahX app/ });
    expect(fab()).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Search people" });
    act(() => input.focus());
    expect(fab()).not.toBeInTheDocument();

    const editor = screen.getByRole("textbox", { name: "Compose rich text" });
    act(() => editor.focus());
    act(() => vi.advanceTimersByTime(0));
    expect(fab()).not.toBeInTheDocument();

    act(() => (editor as HTMLElement).blur());
    act(() => vi.advanceTimersByTime(0));
    expect(fab()).toBeInTheDocument();
    fireEvent.click(fab()!);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("temporarily hides during scrolling so feed content stays readable", () => {
    render(<DraggableInstallButton onOpen={vi.fn()} />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("button", { name: /Install PtahX app/ })).toBeInTheDocument();
    act(() => fireEvent.scroll(window));
    expect(screen.queryByRole("button", { name: /Install PtahX app/ })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(849));
    expect(screen.queryByRole("button", { name: /Install PtahX app/ })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: /Install PtahX app/ })).toBeInTheDocument();
  });

  it("preserves the preferred position when the soft keyboard shrinks the viewport", () => {
    render(<DraggableInstallButton onOpen={vi.fn()} />);
    act(() => vi.advanceTimersByTime(0));
    const fab = screen.getByRole("button", { name: /Install PtahX app/ });
    fireEvent.keyDown(fab, { key: "ArrowLeft" });
    const selectedX = Number.parseFloat(fab.style.left);
    const selectedY = Number.parseFloat(fab.style.top);
    const savedPosition = localStorage.getItem(INSTALL_FAB_POSITION_KEY);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 220 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 380 });
    act(() => fireEvent(window, new Event("resize")));
    expect(Number.parseFloat(fab.style.left)).toBeLessThan(selectedX);
    expect(localStorage.getItem(INSTALL_FAB_POSITION_KEY)).toBe(savedPosition);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    act(() => fireEvent(window, new Event("resize")));
    expect(Number.parseFloat(fab.style.left)).toBe(selectedX);
    expect(Number.parseFloat(fab.style.top)).toBe(selectedY);
  });

  it("identifies editable surfaces but not ordinary feed text", () => {
    const input = document.createElement("input");
    const text = document.createElement("p");
    text.textContent = "Feed";
    expect(isInstallFabObscuredTarget(input)).toBe(true);
    expect(isInstallFabObscuredTarget(text)).toBe(false);
  });

});
