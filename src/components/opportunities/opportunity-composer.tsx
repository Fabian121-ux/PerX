"use client";

import { ArrowLeft, ChevronDown, FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { useConfirm, useToast } from "@/components/ui/feedback-provider";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { createOpportunityAction } from "@/features/opportunities/actions";
import {
  creatableOpportunityTypeOptions,
  currencyOptions,
  defaultOpportunityCategoryByType,
  opportunityCategoryOptions,
} from "@/lib/options";
import {
  clearOpportunityComposerDraft,
  isCreatableOpportunityType,
  readOpportunityComposerDraft,
  writeOpportunityComposerDraft,
  type CreatableOpportunityType,
  type OpportunityComposerDraftFields,
} from "@/lib/opportunities/composer-draft";

/**
 * Fields rendered inside the collapsed "Budget, location and participation"
 * disclosure. An error on one of these must expand the section, otherwise the
 * message exists in the DOM but the user never sees it.
 */
/** Human labels for the error summary, matching the visible field captions. */
const FIELD_LABELS: Record<string, string> = {
  budgetMax: "Budget maximum",
  budgetMin: "Budget minimum",
  category: "Category",
  currency: "Currency",
  description: "Details",
  location: "Location",
  skills: "Skills",
  summary: "Short summary",
  title: "Post title",
  type: "Post type",
};

const OPTIONAL_FIELD_NAMES = new Set([
  "budgetMax",
  "budgetMin",
  "currency",
  "location",
  "skills",
]);

export function OpportunityComposer({
  defaultCategory,
  defaultType,
  error,
  userId,
}: {
  defaultCategory: string;
  defaultType: string;
  error?: string | null;
  userId: string;
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
  const initialType = isCreatableOpportunityType(defaultType)
    ? defaultType
    : "FREELANCE_PROJECT";
  const initialFields = createComposerFields(initialType, defaultCategory);
  const [type, setType] = useState<CreatableOpportunityType>(initialType);
  const [fields, setFields] =
    useState<OpportunityComposerDraftFields>(initialFields);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  /**
   * Explicit publish lifecycle, rather than a generic `loading` flag.
   *
   *   idle -> saving-draft | publishing -> (navigation on success)
   *                                     -> failed (route re-renders with ?error)
   *
   * A successful submit navigates away, so there is no "published" state to
   * render here - the destination route carries the success feedback. A
   * failure returns to this same route with an `error` param, which is why the
   * initial state is derived from `error` instead of always starting at idle.
   */
  /*
    `useActionState` gives the action a return channel. Previously it could only
    redirect, so a rejected budget and a blocked policy phrase both arrived as
    `?error=check-fields` with no indication of which control was at fault.

    The `error` prop is still honoured as the initial state so an existing
    `?error=` URL keeps working - a hard reload or an out-of-band redirect has
    no client state to restore.
  */
  const [state, formAction, isPending] = useActionState(
    createOpportunityAction,
    {
      message: error ?? undefined,
      status: error ? ("error" as const) : ("idle" as const),
    },
  );
  const fieldErrors = state.fieldErrors ?? {};
  const failed = state.status === "error";

  const [submission, setSubmission] = useState<
    "idle" | "publishing" | "saving-draft"
  >("idle");
  const [optionalManuallyOpen, setOptionalManuallyOpen] = useState(
    Boolean(error),
  );
  /*
    Derived rather than assigned from an effect.

    An error on a field inside this disclosure must expand it, otherwise the
    message exists in the DOM but the user never sees why the form refused to
    submit. Computing it during render keeps the section open for exactly as
    long as the error is present, and avoids the extra render pass (and lint
    violation) of calling setState from an effect.
  */
  const optionalOpen =
    optionalManuallyOpen ||
    Object.keys(fieldErrors).some((field) => OPTIONAL_FIELD_NAMES.has(field));
  const setOptionalOpen = setOptionalManuallyOpen;
  const optionalSectionId = useId();

  /*
    Move the user to the first control that actually failed.

    The budget and location inputs live inside a collapsed disclosure, so an
    error there was previously invisible - the page simply refused to submit
    with no visible cause. The section is expanded first, then focus moves on
    the next frame once the control is laid out and focusable.

    Keyed on the error identity so correcting one field and resubmitting moves
    focus again, while an unrelated re-render does not steal it.
  */
  const errorSignature = Object.keys(fieldErrors).sort().join(",");
  useEffect(() => {
    if (!failed || !errorSignature) return;

    const form = formRef.current;
    if (!form) return;

    const [firstField] = errorSignature.split(",");
    const control = form.querySelector<HTMLElement>(`[name="${firstField}"]`);
    if (!control) return;

    requestAnimationFrame(() => {
      control.scrollIntoView({ behavior: "smooth", block: "center" });
      control.focus({ preventScroll: true });
    });
  }, [errorSignature, failed]);
  const fieldsRef = useRef(fields);
  const typeRef = useRef(type);
  const hasContent = hasComposerContent({
    defaultCategory,
    defaultType: initialType,
    fields,
    type,
  });

  useEffect(() => {
    fieldsRef.current = fields;
    typeRef.current = type;
    hasContentRef.current = hasContent;
  }, [fields, hasContent, type]);

  const persistBrowserDraft = useCallback(
    (
      draftType: CreatableOpportunityType,
      draftFields: OpportunityComposerDraftFields,
    ) => {
      if (!hasBrowserDraftContent(draftType, draftFields)) {
        return clearOpportunityComposerDraft(userId, draftType);
      }
      return writeOpportunityComposerDraft(userId, draftType, draftFields);
    },
    [userId],
  );

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      const restored = readOpportunityComposerDraft(userId, initialType);
      if (restored) {
        setFields(restored.fields);
        setDraftStatus("Restored local draft");
      }
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [initialType, userId]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      setDraftStatus(
        persistBrowserDraft(type, fields)
          ? "Saved locally"
          : "Local autosave is unavailable",
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftReady, fields, persistBrowserDraft, type]);

  useEffect(() => {
    const flush = () => {
      persistBrowserDraft(typeRef.current, fieldsRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [persistBrowserDraft]);

  const confirmDiscard = useCallback(async () => {
    if (hasContent) {
      persistBrowserDraft(type, fields);
      const approved = await confirm({
        confirmLabel: "Leave and keep draft",
        description:
          "Your local browser draft will remain available on this device. It has not been saved to your PerX account.",
        title: "Leave Create Post?",
      });
      if (!approved) return false;
    }
    return true;
  }, [confirm, fields, hasContent, persistBrowserDraft, type]);

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

  useEffect(() => {
    if (state.status !== "error") return;

    // A rejected action stays on this page, so restore the leave guard that was
    // released for submission and stop announcing an operation in progress.
    allowNavigationRef.current = false;
    if (hasContentRef.current) armHistoryGuard();
  }, [armHistoryGuard, state.status]);

  const releaseHistoryGuard = useCallback(
    async (allowNavigation = true) => {
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
    },
    [armHistoryGuard],
  );

  const leaveComposer = useCallback(
    async (href: string) => {
      if (!(await confirmDiscard())) return;
      await releaseHistoryGuard();
      router.push(href);
    },
    [confirmDiscard, releaseHistoryGuard, router],
  );

  useEffect(() => {
    if (!hasContent) {
      if (historyGuardActiveRef.current) {
        void releaseHistoryGuard(false);
      }
      return;
    }
    if (allowNavigationRef.current || historyGuardActiveRef.current) {
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
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
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

  const updateField = <K extends keyof OpportunityComposerDraftFields>(
    key: K,
    value: OpportunityComposerDraftFields[K],
  ) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const changeType = (nextValue: string) => {
    if (!isCreatableOpportunityType(nextValue) || nextValue === type) return;
    persistBrowserDraft(type, fields);
    const restored = readOpportunityComposerDraft(userId, nextValue);
    setType(nextValue);
    const nextDefaults = createComposerFields(
      nextValue,
      defaultOpportunityCategoryByType[nextValue],
    );
    setFields(
      restored?.fields ?? {
        ...nextDefaults,
        description: fields.description,
        summary: fields.summary,
        title: fields.title,
      },
    );
    setDraftStatus(restored ? "Restored local draft" : "");
  };

  const clearLocalDraft = async () => {
    const approved = await confirm({
      confirmLabel: "Clear local draft",
      description:
        "This removes only this post type's browser recovery for your current PerX account. It does not delete any saved PerX post.",
      title: "Clear this local draft?",
      tone: "danger",
    });
    if (!approved) return;
    clearOpportunityComposerDraft(userId, type);
    const reset = createComposerFields(
      type,
      defaultOpportunityCategoryByType[type],
    );
    setFields(reset);
    setDraftStatus("Local draft cleared");
  };

  return (
    <form
      action={formAction}
      className="min-h-full bg-[color:var(--px-page)]"
      id="create-post-form"
      onSubmit={(event) => {
        const submitter = event.nativeEvent
          .submitter as HTMLButtonElement | null;
        if (historyGuardActiveRef.current && !allowNavigationRef.current) {
          event.preventDefault();
          const form = event.currentTarget;
          void releaseHistoryGuard().then(() =>
            form.requestSubmit(submitter ?? undefined),
          );
          return;
        }
        const savingDraft = submitter?.value === "draft";
        // The browser draft is persisted BEFORE the request leaves. A server
        // rejection re-renders this route with an `error` param and no form
        // state, so without this the user's work would be gone.
        persistBrowserDraft(type, fields);
        allowNavigationRef.current = true;
        setSubmission(savingDraft ? "saving-draft" : "publishing");
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
          pendingLabel="Publishing..."
          size="sm"
          type="submit"
          value="publish"
        >
          Publish
        </PendingSubmitButton>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-3 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:px-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:pb-8">
        <div className="min-w-0">
          {/*
            Publish lifecycle, announced politely so a screen reader user is
            told the submission is in flight rather than being left with a
            silently disabled button.
          */}
          <p aria-live="polite" className="sr-only" role="status">
            {isPending && submission === "publishing"
              ? "Publishing your post."
              : isPending && submission === "saving-draft"
                ? "Saving your draft."
                : ""}
          </p>

          {failed && state.message ? (
            <div
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <p>{state.message}</p>
              {/*
                Name the failing fields. A count alone still leaves the user
                scanning a long form, and the messages are already precise.
              */}
              {Object.keys(fieldErrors).length ? (
                <ul className="mt-2 grid gap-1 font-normal">
                  {Object.entries(fieldErrors).map(([field, message]) => (
                    <li key={field}>
                      <span className="font-semibold">
                        {FIELD_LABELS[field] ?? field}
                      </span>{" "}
                      — {message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {/*
                A failed publish must always offer a way forward. The entered
                content is still in the form and in browser recovery, so
                resubmitting is safe and is the expected retry path.
              */}
              <div className="mt-3 flex flex-wrap gap-2">
                {/*
                  No "Retry publish" when specific fields are invalid:
                  resubmitting unchanged data cannot succeed, and offering it
                  invites a pointless round trip. Retry stays available when the
                  failure was not field-specific (a policy block or an
                  infrastructure error), where a resubmit is meaningful.
                */}
                {Object.keys(fieldErrors).length === 0 ? (
                  <PendingSubmitButton
                    name="intent"
                    pendingLabel="Retrying..."
                    size="sm"
                    type="submit"
                    value="publish"
                  >
                    Retry publish
                  </PendingSubmitButton>
                ) : null}
                <PendingSubmitButton
                  name="intent"
                  pendingLabel="Saving draft..."
                  size="sm"
                  type="submit"
                  value="draft"
                  variant="secondary"
                >
                  Save as draft instead
                </PendingSubmitButton>
              </div>
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
                error={fieldErrors.title}
                hint="Use a specific, scannable title."
                label="Post title"
                name="title"
              >
                <Input
                  maxLength={140}
                  minLength={8}
                  aria-invalid={Boolean(fieldErrors.title)}
                  name="title"
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="e.g. Looking for a product designer for a fintech launch"
                  required
                  value={fields.title}
                />
              </Field>
              <Field
                error={fieldErrors.summary}
                name="summary"
                hint={`${fields.summary.length}/260 characters`}
                label="Short summary"
              >
                <Input
                  maxLength={260}
                  minLength={20}
                  aria-invalid={Boolean(fieldErrors.summary)}
                  name="summary"
                  onChange={(event) =>
                    updateField("summary", event.target.value)
                  }
                  placeholder="Give people the essential context at a glance"
                  required
                  value={fields.summary}
                />
              </Field>
              <Field
                error={fieldErrors.description}
                name="description"
                hint={`${fields.description.length}/4000 characters. Include scope, outcomes, timing, and expectations.`}
                label="Details"
              >
                <Textarea
                  className="min-h-56 resize-y text-base leading-7"
                  maxLength={4000}
                  minLength={80}
                  aria-invalid={Boolean(fieldErrors.description)}
                  name="description"
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Describe the opportunity clearly enough for the right people to respond..."
                  required
                  value={fields.description}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Post type">
                  <Select
                    name="type"
                    onChange={(event) => changeType(event.target.value)}
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
                  <Select
                    name="category"
                    onChange={(event) =>
                      updateField(
                        "category",
                        event.target
                          .value as OpportunityComposerDraftFields["category"],
                      )
                    }
                    required
                    value={fields.category}
                  >
                    {opportunityCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <section className="grid gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <button
                  aria-controls={optionalSectionId}
                  aria-expanded={optionalOpen}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 text-left text-sm font-black text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] sm:hidden"
                  onClick={() => setOptionalOpen((current) => !current)}
                  type="button"
                >
                  Budget, location and participation
                  <ChevronDown
                    aria-hidden
                    className={`transition ${optionalOpen ? "rotate-180" : ""}`}
                    size={18}
                  />
                </button>
                <div
                  className={`${optionalOpen ? "grid" : "hidden"} gap-4 sm:grid`}
                  id={optionalSectionId}
                >
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Field label="Currency">
                      <Select
                        name="currency"
                        onChange={(event) =>
                          updateField(
                            "currency",
                            event.target
                              .value as OpportunityComposerDraftFields["currency"],
                          )
                        }
                        required
                        value={fields.currency}
                      >
                        {currencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      error={fieldErrors.budgetMin}
                      name="budgetMin"
                      hint="Digits and up to two decimal places; do not include commas."
                      label={`Budget minimum (${fields.currency})`}
                    >
                      <MoneyInput
                        aria-label={`Budget minimum (${fields.currency})`}
                        currency={fields.currency}
                        aria-invalid={Boolean(fieldErrors.budgetMin)}
                        name="budgetMin"
                        onChange={(event) =>
                          updateField("budgetMin", event.target.value)
                        }
                        placeholder="250000.00"
                        value={fields.budgetMin}
                      />
                    </Field>
                    <Field
                      error={fieldErrors.budgetMax}
                      name="budgetMax"
                      hint="Digits and up to two decimal places; do not include commas."
                      label={`Budget maximum (${fields.currency})`}
                    >
                      <MoneyInput
                        aria-label={`Budget maximum (${fields.currency})`}
                        currency={fields.currency}
                        aria-invalid={Boolean(fieldErrors.budgetMax)}
                        name="budgetMax"
                        onChange={(event) =>
                          updateField("budgetMax", event.target.value)
                        }
                        placeholder="1200000.00"
                        value={fields.budgetMax}
                      />
                    </Field>
                    <Field
                      error={fieldErrors.location}
                      name="location"
                      label="Location"
                    >
                      <Input
                        maxLength={120}
                        aria-invalid={Boolean(fieldErrors.location)}
                        name="location"
                        onChange={(event) =>
                          updateField("location", event.target.value)
                        }
                        placeholder="Lagos, hybrid"
                        value={fields.location}
                      />
                    </Field>
                  </div>

                  <Field
                    error={fieldErrors.skills}
                    name="skills"
                    hint="Separate skills with commas."
                    label="Skills or expertise"
                  >
                    <Input
                      maxLength={500}
                      aria-invalid={Boolean(fieldErrors.skills)}
                      name="skills"
                      onChange={(event) =>
                        updateField("skills", event.target.value)
                      }
                      placeholder="Product design, Research, Fintech"
                      value={fields.skills}
                    />
                  </Field>

                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 text-sm font-semibold text-[color:var(--px-text)]">
                    <input
                      checked={fields.remote}
                      className="size-5 accent-[color:var(--px-primary)]"
                      name="remote"
                      onChange={(event) =>
                        updateField("remote", event.target.checked)
                      }
                      type="checkbox"
                    />
                    Remote participation is supported
                  </label>
                </div>
              </section>

              <div className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-muted)] p-3 text-xs leading-5 text-[color:var(--px-text-muted)]">
                Browser recovery is local to this device and scoped to your PerX
                account and post type. Do not enter private contact, payment,
                identity-document, or verification information.
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {/*
                    Named so it stays addressable now that the composer has a
                    second live region for the publish lifecycle.
                  */}
                  <span
                    aria-label="Local draft status"
                    aria-live="polite"
                    role="status"
                  >
                    {draftStatus}
                  </span>
                  <button
                    className="min-h-11 rounded-xl px-3 font-black text-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                    onClick={() => void clearLocalDraft()}
                    type="button"
                  >
                    Clear local draft
                  </button>
                </div>
              </div>
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
              <li>
                Only supported listing images can be uploaded after saving.
              </li>
              <li>Published content remains subject to PerX moderation.</li>
            </ul>
          </section>
          <section className="rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-5">
            <h2 className="font-black text-[color:var(--px-text)]">
              Not ready yet?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Complete the required details, then save without publishing and
              continue from Manage Posts.
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

function createComposerFields(
  type: CreatableOpportunityType,
  category: string,
): OpportunityComposerDraftFields {
  const validCategory = opportunityCategoryOptions.some(
    (option) => option.value === category,
  )
    ? (category as OpportunityComposerDraftFields["category"])
    : defaultOpportunityCategoryByType[type];
  return {
    budgetMax: "",
    budgetMin: "",
    category: validCategory,
    contactPreference: "",
    currency: "NGN",
    description: "",
    listingRulesAccepted: false,
    location: "",
    propertyListingType: "",
    propertyType: "",
    remote: true,
    skills: "",
    summary: "",
    title: "",
  };
}

function hasBrowserDraftContent(
  type: CreatableOpportunityType,
  fields: OpportunityComposerDraftFields,
) {
  const defaults = createComposerFields(
    type,
    defaultOpportunityCategoryByType[type],
  );
  return (
    Object.keys(fields) as Array<keyof OpportunityComposerDraftFields>
  ).some((key) => fields[key] !== defaults[key]);
}

function hasComposerContent({
  defaultCategory,
  defaultType,
  fields,
  type,
}: {
  defaultCategory: string;
  defaultType: CreatableOpportunityType;
  fields: OpportunityComposerDraftFields;
  type: CreatableOpportunityType;
}) {
  const defaults = createComposerFields(defaultType, defaultCategory);
  return Boolean(
    type !== defaultType ||
    (Object.keys(fields) as Array<keyof OpportunityComposerDraftFields>).some(
      (key) => fields[key] !== defaults[key],
    ),
  );
}
