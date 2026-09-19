// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * P0-7 C: the roles page must offer exactly what the server will accept.
 *
 * The page hardcoded five checkboxes; the server accepts two. CLIENT, FOUNDER
 * and PROPERTY_OWNER each carry `opportunity:create`, so they were deliberately
 * removed from `selfAssignableRoles` - self-assignment would have been a bypass
 * of trader review. The server is right; the UI was stale.
 *
 * The visible failure was worse than a no-op: ticking only "Client" filtered to
 * an empty set and redirected to `?error=choose-role` - an error telling the
 * user to choose a role they had just chosen.
 *
 * These tests assert the DERIVATION, not today's two values. Adding a role to
 * `selfAssignableRoles` must change the UI with no second edit, because that
 * drift is the bug.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateRolesAction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/features/roles/actions", () => ({
  updateRolesAction: mocks.updateRolesAction,
}));

import RolesPage from "@/app/app/roles/page";
import {
  roleLabels,
  selfAssignableRoles,
} from "@/lib/permissions/capabilities";

async function renderRolesPage(roles: string[] = []) {
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1", roles });
  return render(await RolesPage());
}

function renderedRoleValues(view: Awaited<ReturnType<typeof renderRolesPage>>) {
  return Array.from(
    view.container.querySelectorAll('input[name="roles"]'),
  ).map((input) => (input as HTMLInputElement).value);
}

describe("roles page options are derived from the server's allow-list", () => {
  it("renders exactly the self-assignable roles, no more and no fewer", async () => {
    const view = await renderRolesPage();

    expect(renderedRoleValues(view).sort()).toEqual(
      [...selfAssignableRoles].sort(),
    );
  });

  it("offers no role the server would silently discard", async () => {
    const view = await renderRolesPage();

    for (const value of renderedRoleValues(view)) {
      expect(selfAssignableRoles.has(value as never)).toBe(true);
    }
  });

  it("no longer offers the three roles that carry opportunity:create", async () => {
    const view = await renderRolesPage();
    const values = renderedRoleValues(view);

    // Named explicitly: these are the ones that made the gate decorative.
    expect(values).not.toContain("CLIENT");
    expect(values).not.toContain("FOUNDER");
    expect(values).not.toContain("PROPERTY_OWNER");
  });

  it("labels each option from the shared role labels", async () => {
    const view = await renderRolesPage();

    for (const role of selfAssignableRoles) {
      expect(view.getByText(roleLabels[role])).toBeTruthy();
    }
  });

  it("keeps a role the user already holds checked", async () => {
    const [first] = [...selfAssignableRoles];
    const view = await renderRolesPage([first]);

    const input = view.container.querySelector(
      `input[value="${first}"]`,
    ) as HTMLInputElement;
    expect(input.defaultChecked).toBe(true);
  });

  it("points the user at the trader application for creation access", async () => {
    const view = await renderRolesPage();
    const text = view.container.textContent ?? "";

    // Removing the options without saying where creation access comes from
    // would replace a misleading control with a dead end.
    expect(text).toMatch(/trader/i);
    expect(
      view.container.querySelector('a[href="/app/trader"]'),
    ).toBeTruthy();
  });
});

describe("the allow-list is the single source of truth", () => {
  it("exports a set the page and the action can both read", () => {
    expect(selfAssignableRoles).toBeInstanceOf(Set);
    expect(selfAssignableRoles.size).toBeGreaterThan(0);
    // Every entry must be a real role with a label, or the UI cannot render it.
    for (const role of selfAssignableRoles) {
      expect(roleLabels[role]).toBeTruthy();
    }
  });
});
