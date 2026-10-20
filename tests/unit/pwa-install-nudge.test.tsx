// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { InstallAppNudge } from "@/components/pwa/install-app-nudge";
import { INSTALL_INITIAL_DELAY_MS, INSTALL_STATE_KEY } from "@/lib/pwa/install-policy";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

function signalNativeInstall() {
  const prompt = vi.fn(async () => undefined);
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  act(() => window.dispatchEvent(event));
  return prompt;
}

describe("Install PtahX pop-up and floating affordance", () => {
  it("opens after a short delay and leaves a visible floating button after dismissal", () => {
    render(<InstallAppNudge />);
    signalNativeInstall();
    // First encounter: show the modal first, then leave the floating icon.
    expect(screen.queryByRole("button", { name: "Install PtahX app" })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(INSTALL_INITIAL_DELAY_MS - 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Maybe later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install PtahX app" })).toBeInTheDocument();
    expect(localStorage.getItem(INSTALL_STATE_KEY)).not.toBeNull();
  });
  it("does not repeat the auto-popup within seven days but floating install stays available", () => {
    localStorage.setItem(INSTALL_STATE_KEY, String(Date.now()));
    render(<InstallAppNudge />);
    signalNativeInstall();
    act(() => vi.advanceTimersByTime(INSTALL_INITIAL_DELAY_MS + 2000));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Install PtahX app" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("uses the browser install prompt only when a real native install event exists", async () => {
    render(<InstallAppNudge />);
    const prompt = signalNativeInstall();
    act(() => vi.advanceTimersByTime(INSTALL_INITIAL_DELAY_MS));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install PtahX" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(screen.queryByRole("button", { name: "Install PtahX app" })).not.toBeInTheDocument();
  });
  it("never shows an install surface inside an already-installed standalone app", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      }),
    });
    render(<InstallAppNudge />);
    act(() => vi.advanceTimersByTime(INSTALL_INITIAL_DELAY_MS + 500));
    expect(screen.queryByRole("button", { name: "Install PtahX app" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
