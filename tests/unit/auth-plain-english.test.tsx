import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ delivery: vi.fn(), supabase: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => null }));
vi.mock("@/lib/auth/provider", () => ({ usesSupabaseAuth: mocks.supabase }));
vi.mock("@/lib/auth/password-reset-delivery", () => ({
  isPasswordResetDeliveryConfigured: mocks.delivery,
}));
vi.mock("@/components/standard-page", () => ({
  PublicPageShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/brand-logo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/auth/sign-in-form", () => ({
  SignInForm: ({ initialState }: { initialState?: { message?: string } }) => (
    <p>{initialState?.message}</p>
  ),
}));
vi.mock("@/components/auth/password-recovery-form", () => ({
  PasswordRecoveryForm: () => null,
}));
import SignInPage from "@/app/(auth)/sign-in/page";
import PasswordRecoveryPage from "@/app/(auth)/password-recovery/page";
beforeEach(() => {
  mocks.supabase.mockReturnValue(false);
  mocks.delivery.mockReturnValue(false);
});
it("confirmation failure gives a clickable next step without account-link jargon", async () => {
  const invalid = renderToStaticMarkup(
    await SignInPage({
      searchParams: Promise.resolve({ confirmation: "invalid" }),
    }),
  );
  expect(invalid).toMatch(/link.*(expired|no longer valid)/i);
  expect(invalid).toMatch(
    /href="\/password-recovery"[^>]*>\s*Request a new reset link/i,
  );
  const unavailable = renderToStaticMarkup(
    await SignInPage({
      searchParams: Promise.resolve({ confirmation: "unavailable" }),
    }),
  );
  expect(unavailable).toMatch(/contact support/i);
  expect(unavailable).not.toMatch(/account link|provider identity|Supabase/i);
});
it.each(["database-not-configured", "account-deactivated", "server-error"])(
  "sign-in error %s offers an action without implementation details",
  async (error) => {
    const markup = renderToStaticMarkup(
      await SignInPage({ searchParams: Promise.resolve({ error }) }),
    );
    expect(markup).toMatch(/try again|contact support/i);
    expect(markup).not.toMatch(/database|authentication service|server error/i);
  },
);
it("unavailable email delivery never claims a request was stored or sent", async () => {
  const markup = renderToStaticMarkup(
    await PasswordRecoveryPage({
      searchParams: Promise.resolve({ status: "requested" }),
    }),
  );
  expect(markup).toMatch(/contact support/i);
  expect(markup).not.toMatch(
    /request was recorded|on its way|we.*ll send you/i,
  );
});
it.each([false, true])(
  "recovery stays conditional and gives a next step (Supabase=%s)",
  async (supabase) => {
    mocks.supabase.mockReturnValue(supabase);
    mocks.delivery.mockReturnValue(true);
    const markup = renderToStaticMarkup(
      await PasswordRecoveryPage({
        searchParams: Promise.resolve({ status: "requested" }),
      }),
    );
    expect(markup).toMatch(/If an account matches this email/i);
    expect(markup).toMatch(/inbox|spam/i);
    expect(markup).not.toMatch(/we found|no account exists|eligible/i);
  },
);
