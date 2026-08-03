import { describe, expect, it } from "vitest";

import { shouldSubmitMessage } from "@/lib/messages/composer-keyboard";

describe("message composer keyboard contract", () => {
  it("leaves plain and shifted Enter available for new lines", () => {
    expect(
      shouldSubmitMessage({
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
      }),
    ).toBe(false);
    expect(
      shouldSubmitMessage({
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
      }),
    ).toBe(false);
  });

  it("supports Ctrl Enter and Command Enter", () => {
    expect(
      shouldSubmitMessage({ ctrlKey: true, key: "Enter", metaKey: false }),
    ).toBe(true);
    expect(
      shouldSubmitMessage({ ctrlKey: false, key: "Enter", metaKey: true }),
    ).toBe(true);
  });

  it("never submits during IME composition or key code 229", () => {
    expect(
      shouldSubmitMessage({
        ctrlKey: true,
        isComposing: true,
        key: "Enter",
        metaKey: false,
      }),
    ).toBe(false);
    expect(
      shouldSubmitMessage({
        ctrlKey: true,
        key: "Enter",
        keyCode: 229,
        metaKey: false,
      }),
    ).toBe(false);
  });
});
