"use client";

import { ArrowLeft, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  useConfirm,
  useToast,
} from "@/components/ui/feedback-provider";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { createOpportunityAction } from "@/features/opportunities/actions";
import {
  contactPreferenceOptions,
  creatableOpportunityTypeOptions,
  currencyOptions,
  opportunityCategoryOptions,
  propertyListingTypeOptions,
  propertyTypeOptions,
} from "@/lib/options";

export function OpportunityComposer({
  defaultCategory,
  defaultType,
  error,
}: {
  defaultCategory: string;
  defaultType: string;
  error?: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const allowNavigationRef = useRef(false);
  const composerUrlRef = useRef("");
  const discardConfirmationPendingRef = useRef(false);
  const hasContentRef = useRef(false);
  const historyGuardActiveRef = useRef(false);
  const historyReleaseRef = useRef<(() => void) | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [type, setType] = useState(defaultType);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [summaryLength, setSummaryLength] = useState(0);
  const propertyMode = type === "PROPERTY";

  const confirmDiscard = useCallback(async () => {
    if (hasContent) {
      const approved = await confirm({
        confirmLabel: "Discard changes",
        description:
          "Your entered content has not been saved. You can stay and save it as a draft instead.",
        title: "Discard this draft?",
        tone: "danger",
      });
      if (!approved) return false;
    }
    return true;
  }, [confirm, hasContent]);

  const armHistoryGuard = useCallback(() => {
    if (historyGuardActiveRef.current || allowNavigationRef.current) return;
    composerUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState(
      { ...window.history.state, perxOpportunityComposerGuard: true },
      "",
      composerUrlRef.current,
    );
    historyGuardActiveRef.current = true;
  }, []);

  const releaseHistoryGuard = useCallback(async (allowNavigation = true) => {
    if (allowNavigation) allowNavigationRef.current = true;
    if (!historyGuardActiveRef.current) return;

    await new Promise<void>((resolve) => {
      historyReleaseRef.current = resolve;
      window.history.back();
    });
    if (
      !allowNavigation &&
      hasContentRef.current &&
      !allowNavigationRef.current
    ) {
      armHistoryGuard();
    }
  }, [armHistoryGuard]);

  const leaveComposer = useCallback(async (href: string) => {
    if (!(await confirmDiscard())) return;
    await releaseHistoryGuard();
    router.push(href);
  }, [confirmDiscard, releaseHistoryGuard, router]);

  useEffect(() => {
    if (!hasContent) {
      if (historyGuardActiveRef.current) {
        void releaseHistoryGuard(false);
      }
      return;
    }
    if (
      allowNavigationRef.current ||
      historyGuardActiveRef.current
    ) {
      return;
    }

    armHistoryGuard();
  }, [armHistoryGuard, hasContent, releaseHistoryGuard]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasContent || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasContent || allowNavigationRef.current || event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      const anchor = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!anchor || anchor.target === "_blank") return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash
      ) {
        return;
      }
      event.preventDefault();
      void leaveComposer(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    };
    const handlePopState = () => {
      if (historyReleaseRef.current) {
        const resolve = historyReleaseRef.current;
        historyReleaseRef.current = null;
        historyGuardActiveRef.current = false;
        resolve();
        return;
      }
      if (
        !historyGuardActiveRef.current ||
        allowNavigationRef.current ||
        !hasContent
      ) {
        historyGuardActiveRef.current = false;
        return;
      }

      window.history.pushState(
        { ...window.history.state, perxOpportunityComposerGuard: true },
        "",
        composerUrlRef.current,
      );
      historyGuardActiveRef.current = true;
      if (discardConfirmationPendingRef.current) return;
      discardConfirmationPendingRef.current = true;
      void (async () => {
        if (await confirmDiscard()) {
          discardConfirmationPendingRef.current = false;
          await releaseHistoryGuard();
          window.history.back();
          return;
        }
        discardConfirmationPendingRef.current = false;
      })();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmDiscard, hasContent, leaveComposer, releaseHistoryGuard]);

  const updateContentState = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const meaningfulFields = [
      "authorityDeclaration",
      "budgetMax",
      "budgetMin",
      "description",
      "location",
      "propertyListingType",
      "propertyType",
      "skills",
      "summary",
      "title",
    ];
    const changedDefaults =
      data.get("type") !== defaultType ||
      data.get("category") !== defaultCategory ||
      data.get("currency") !== "NGN" ||
      data.get("remote") !== "on" ||
      (data.get("type") === "PROPERTY" &&
        Boolean(data.get("contactPreference"))) ||
      Boolean(data.get("listingRulesAccepted"));
    const nextHasContent = Boolean(
      changedDefaults ||
        meaningfulFields.some((name) => String(data.get(name) ?? "").trim()),
    );
    hasContentRef.current = nextHasContent;
    setHasContent(nextHasContent);
  };

  return (
    <form
      action={createOpportunityAction}
      className="min-h-full bg-[color:var(--px-page)]"
      id="create-post-form"
      onChange={updateContentState}
      onSubmit={(event) => {
        const submitter = event.nativeEvent.submitter as HTMLButtonElement | null;
        if (
          historyGuardActiveRef.current &&
          !allowNavigationRef.current
        ) {
          event.preventDefault();
          const form = event.currentTarget;
          void releaseHistoryGuard().then(() =>
            form.requestSubmit(submitter ?? undefined),
          );
          return;
        }
        const savingDraft = submitter?.value === "draft";
        allowNavigationRef.current = true;
        toast({
          description: "Your content is being validated and saved.",
          title: savingDraft ? "Saving draft" : "Publishing post",
        });
      }}
      ref={formRef}
    >
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[color:var(--px-border)] bg-[color:var(--px-surface)]/96 px-[max(0.75rem,env(safe-area-inset-left))] py-2 backdrop-blur sm:px-5">
        <Button
          aria-label="Back from Create Post"
          onClick={() => void leaveComposer("/app")}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden size={20} />
        </Button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-black text-[color:var(--px-text)] sm:text-base">
            Create Post
          </p>
          <p className="hidden text-xs text-[color:var(--px-text-muted)] sm:block">
            Share a structured opportunity with the PerX network
          </p>
        </div>
        <PendingSubmitButton
          name="intent"
          pendingLabel={propertyMode ? "Saving..." : "Publishing..."}
          size="sm"
          type="submit"
          value={propertyMode ? "draft" : "publish"}
        >
          {propertyMode ? "Save & add images" : "Publish"}
        </PendingSubmitButton>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-3 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:px-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:pb-8">
        <div className="min-w-0">
          {error ? (
            <div
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <section className="rounded-[24px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 shadow-sm sm:p-6">
            <div className="mb-6 flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
                <FileText aria-hidden size={20} />
              </span>
              <div>
                <h1 className="text-xl font-black text-[color:var(--px-text)] sm:text-2xl">
                  What would you like to share?
                </h1>
                <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  PerX posts are structured opportunities that can progress into
                  proposals, agreements, and trust-backed records.
                </p>
              </div>
            </div>

            <div className="grid gap-5">
              <Field
                hint="Use a specific, scannable title."
                label="Post title"
              >
                <Input
                  autoFocus={!error}
                  maxLength={140}
                  minLength={8}
                  name="title"
                  placeholder="e.g. Looking for a product designer for a fintech launch"
                  required
                />
              </Field>
              <Field
                hint={`${summaryLength}/260 characters`}
                label="Short summary"
              >
                <Input
                  maxLength={260}
                  minLength={20}
                  name="summary"
                  onChange={(event) => setSummaryLength(event.target.value.length)}
                  placeholder="Give people the essential context at a glance"
                  required
                />
              </Field>
              <Field
                hint={`${descriptionLength}/4000 characters. Include scope, outcomes, timing, and expectations.`}
                label="Details"
              >
                <Textarea
                  className="min-h-56 resize-y text-base leading-7"
                  maxLength={4000}
                  minLength={80}
                  name="description"
                  onChange={(event) =>
                    setDescriptionLength(event.target.value.length)
                  }
                  placeholder="Describe the opportunity clearly enough for the right people to respond..."
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Post type">
                  <Select
                    name="type"
                    onChange={(event) => setType(event.target.value)}
                    required
                    value={type}
                  >
                    {creatableOpportunityTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Category">
                  <Select defaultValue={defaultCategory} name="category" required>
                    {opportunityCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Currency">
                  <Select defaultValue="NGN" name="currency" required>
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Budget minimum">
                  <Input
                    inputMode="decimal"
                    name="budgetMin"
                    placeholder="250000.00"
                  />
                </Field>
                <Field label="Budget maximum">
                  <Input
                    inputMode="decimal"
                    name="budgetMax"
                    placeholder="1200000.00"
                  />
                </Field>
                <Field label="Location">
                  <Input name="location" placeholder="Lagos, hybrid" />
                </Field>
              </div>

              <Field
                hint="Separate skills with commas."
                label="Skills or expertise"
              >
                <Input
                  maxLength={500}
                  name="skills"
                  placeholder="Product design, Research, Fintech"
                />
              </Field>

              {propertyMode ? (
                <section className="grid gap-4 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      aria-hidden
                      className="mt-0.5 text-[color:var(--px-primary)]"
                      size={20}
                    />
                    <div>
                      <h2 className="font-black text-[color:var(--px-text)]">
                        Property verification details
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
                        Save the draft, add real listing images, then submit it
                        for PerX review from the edit page.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Property type">
                      <Select name="propertyType" required>
                        <option value="">Choose type</option>
                        {propertyTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Listing type">
                      <Select name="propertyListingType" required>
                        <option value="">Choose listing</option>
                        {propertyListingTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Contact preference">
                      <Select name="contactPreference" required>
                        <option value="">Choose contact</option>
                        {contactPreferenceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Ownership or authority declaration">
                    <Textarea
                      maxLength={1000}
                      minLength={20}
                      name="authorityDeclaration"
                      placeholder="State your authority to list this property."
                      required
                    />
                  </Field>
                  <label className="flex min-h-11 items-start gap-3 rounded-xl bg-[color:var(--px-surface)] p-3 text-sm font-semibold text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)]">
                    <input
                      className="mt-0.5 size-5 accent-[color:var(--px-primary)]"
                      name="listingRulesAccepted"
                      required
                      type="checkbox"
                    />
                    <span>
                      I confirm this listing is accurate and understand PerX
                      review does not replace legal property due diligence.
                    </span>
                  </label>
                </section>
              ) : null}

              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[color:var(--px-border)] px-3 text-sm font-semibold text-[color:var(--px-text)]">
                <input
                  className="size-5 accent-[color:var(--px-primary)]"
                  defaultChecked
                  name="remote"
                  type="checkbox"
                />
                Remote participation is supported
              </label>
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20 xl:self-start">
          <section className="rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[color:var(--px-primary)]">
              <Sparkles aria-hidden size={18} />
              <h2 className="font-black">Before you publish</h2>
            </div>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              <li>Be specific about the outcome and who should respond.</li>
              <li>Do not include private contact or payment information.</li>
              <li>Only supported listing images can be uploaded after saving.</li>
              <li>Published content remains subject to PerX moderation.</li>
            </ul>
          </section>
          <section className="rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-5">
            <h2 className="font-black text-[color:var(--px-text)]">
              Not ready yet?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Complete the required details, then save without publishing and continue from Manage Posts.
            </p>
            <PendingSubmitButton
              className="mt-4 w-full"
              name="intent"
              pendingLabel="Saving draft..."
              type="submit"
              value="draft"
              variant="secondary"
            >
              Save draft
            </PendingSubmitButton>
          </section>
        </aside>
      </div>
    </form>
  );
}
