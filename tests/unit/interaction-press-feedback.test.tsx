// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InteractionPressFeedback } from "@/components/ui/interaction-press-feedback";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("instant site-wide tap acknowledgement", () => {
  it("marks clickable buttons as pressed on pointer-down before a click completes", () => {
    const onClick = vi.fn();
    const view = render(<><InteractionPressFeedback /><button onClick={onClick}>Save</button></>);
    const button = view.getByRole("button", { name: "Save" });

    fireEvent.pointerDown(button, { button: 0 });
    expect(button.getAttribute("data-ptahx-pressed")).toBe("true");
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(260));
    expect(button.hasAttribute("data-ptahx-pressed")).toBe(false);
  });

  it("gives links and keyboard users the same visible press state", () => {
    const view = render(
      <><InteractionPressFeedback /><a href="/app/messages">Messages</a></>,
    );
    const link = view.getByRole("link", { name: "Messages" });

    fireEvent.keyDown(link, { key: "Enter" });
    expect(link.getAttribute("data-ptahx-pressed")).toBe("true");
    act(() => vi.advanceTimersByTime(260));
    expect(link.hasAttribute("data-ptahx-pressed")).toBe(false);
    fireEvent.pointerDown(link, { button: 0 });
    expect(link.getAttribute("data-ptahx-pressed")).toBe("true");
  });

  it("never pretends a disabled button was pressed", () => {
    const view = render(<><InteractionPressFeedback /><button disabled>Unavailable</button></>);
    const button = view.getByRole("button", { name: "Unavailable" });
    fireEvent.pointerDown(button, { button: 0 });
    expect(button.hasAttribute("data-ptahx-pressed")).toBe(false);
  });

  it("cleans up its temporary feedback after unmounting", () => {
    const view = render(<><InteractionPressFeedback /><button>Next</button></>);
    const button = view.getByRole("button", { name: "Next" });
    fireEvent.pointerDown(button, { button: 0 });
    expect(button.hasAttribute("data-ptahx-pressed")).toBe(true);
    view.unmount();
    expect(button.hasAttribute("data-ptahx-pressed")).toBe(false);
  });
});
