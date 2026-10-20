// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampInstallFabPosition,
  DraggableInstallButton,
  INSTALL_FAB_POSITION_KEY,
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
});
