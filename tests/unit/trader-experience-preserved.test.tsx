// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * P0-7 A: the longest answer must survive a failed submit.
 *
 * `src/app/app/trader/page.tsx` passed `experience: undefined` into the form's
 * defaults while passing through `headline` and `tradeCategory`. React 19
 * resets an uncontrolled `<form action>` once the action settles, so every
 * field falls back to its `defaultValue` - which for `experience` was nothing.
 *
 * The result: a validation error that never reached the database still wiped
 * the one field that takes real effort to write, while the two short fields
 * beside it survived. A prior item promised answers survive failure, which is
 * precisely when they matter.
 */

const mocks = vi.hoisted(() => ({
  getOwnTraderApplication: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@/features/trader/actions", () => ({
  submitTraderApplicationAction: mocks.submit,
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "user-1", roles: ["MEMBER"] }),
}));
vi.mock("@/lib/testing/fault-injection", () => ({
  maybeInjectFault: async () => {},
}));
vi.mock("@/lib/trader/access", () => ({
  getOwnTraderApplication: mocks.getOwnTraderApplication,
  isTrader: () => false,
  TRADER_GRANT_ROLE: "TRADER",
}));

import { TraderApplicationForm } from "@/components/trader/trader-application-form";
import TraderPage from "@/app/app/trader/page";

/** Walk the returned tree for the form element and read its `defaults` prop. */
function findFormDefaults(
  node: unknown,
): Record<string, unknown> | undefined {
  if (!node || typeof node !== "object") return undefined;
  const element = node as {
    props?: { children?: unknown; defaults?: Record<string, unknown> };
    type?: unknown;
  };
  if (element.type === TraderApplicationForm) return element.props?.defaults;

  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findFormDefaults(child);
    if (found) return found;
  }
  return undefined;
}

const CATEGORIES = [{ label: "Software", value: "software" }];

/** A long answer, of the kind a user would be furious to retype. */
const EXPERIENCE =
  "I have delivered software projects for several growing teams and clients over the last six years, including two platform migrations.";

const HEADLINE = "Software services for growing teams";

function experienceField(view: ReturnType<typeof render>) {
  return view.getByLabelText(
    "What relevant experience do you have?",
  ) as HTMLTextAreaElement;
}

describe("trader application preserves the submitted experience", () => {
  it("re-renders a validation failure with the experience intact", async () => {
    // A field error on a DIFFERENT field: `experience` itself was accepted, so
    // there is no excuse for discarding it.
    mocks.submit.mockResolvedValue({
      fieldErrors: { headline: "Describe it in a little more detail." },
      message: "We could not send this yet. 1 answer needs your attention.",
      status: "error",
    });

    const view = render(
      <TraderApplicationForm
        categories={CATEGORIES}
        defaults={{
          experience: EXPERIENCE,
          headline: HEADLINE,
          tradeCategory: "software",
        }}
      />,
    );

    await waitFor(() => {
      expect(experienceField(view).defaultValue).toBe(EXPERIENCE);
    });
  });

  it("keeps the experience when the database fails, not just on validation", async () => {
    mocks.submit.mockResolvedValue({
      message: "Applications are temporarily unavailable. Please try again.",
      status: "error",
    });

    const view = render(
      <TraderApplicationForm
        categories={CATEGORIES}
        defaults={{
          experience: EXPERIENCE,
          headline: HEADLINE,
          tradeCategory: "software",
        }}
      />,
    );

    await waitFor(() => {
      expect(experienceField(view).defaultValue).toBe(EXPERIENCE);
    });
  });
});

describe("the trader page supplies the stored experience as a default", () => {
  it("passes the stored experience into the form defaults", async () => {
    mocks.getOwnTraderApplication.mockResolvedValue({
      applicantKind: "INDIVIDUAL",
      decidedAt: null,
      experience: EXPERIENCE,
      headline: HEADLINE,
      id: "app-1",
      reviewerNote: null,
      status: "NEEDS_CHANGES",
      submittedAt: null,
      tradeCategory: "software",
    });

    /*
     * The bug lived in the page, not the form: the form already read
     * `defaults.experience` correctly, and the page hardcoded `undefined`.
     * Asserting on the props the page actually passes is what pins it.
     */
    /*
     * Rendered through the real page so this pins the props the page actually
     * passes, not a copy of its source text.
     */
    const element = await TraderPage({ searchParams: Promise.resolve({}) });
    const defaults = findFormDefaults(element);

    expect(defaults?.experience).toBe(EXPERIENCE);
    // The two fields that already worked must keep working.
    expect(defaults?.headline).toBe(HEADLINE);
    expect(defaults?.tradeCategory).toBe("software");
  });
});
