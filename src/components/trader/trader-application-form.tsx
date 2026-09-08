"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  submitTraderApplicationAction,
  type TraderApplicationFormState,
} from "@/features/trader/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormNotice } from "@/components/ui/form-notice";

type CategoryOption = { label: string; value: string };

const STEPS = ["What you trade", "About you", "Review"] as const;
const FIELD_STEP: Record<string, number> = {
  applicantKind: 1,
  experience: 1,
  headline: 0,
  tradeCategory: 0,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={16} />
          Sending application
        </>
      ) : (
        "Submit application"
      )}
    </Button>
  );
}

/**
 * Short guided application.
 *
 * Three steps of one or two questions each, rather than one long form. All
 * fields stay mounted so the browser keeps their values while stepping and a
 * single submit carries the whole payload - stepping is a presentation concern,
 * not a multi-request wizard with server state to reconcile.
 *
 * Server-side validation still owns correctness. Continue uses native browser
 * constraints only to avoid advancing past an obviously incomplete visible
 * step; the server remains authoritative for every submitted value.
 */
export function TraderApplicationForm({
  categories,
  defaults,
}: {
  categories: CategoryOption[];
  defaults?: {
    applicantKind?: string;
    experience?: string;
    headline?: string;
    tradeCategory?: string;
  };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(submitTraderApplicationAction, {
    status: "idle",
  } satisfies TraderApplicationFormState);

  const [step, setStep] = useState(0);
  const fieldErrors = state.fieldErrors ?? {};
  const isLast = step === STEPS.length - 1;
  const errorSignature = Object.keys(fieldErrors).sort().join(",");

  /*
   * A server error can belong to a field on a previous hidden step. Move back
   * to the earliest failing step and focus the first invalid control so the
   * user never gets a generic error while the actual problem is invisible.
   */
  useEffect(() => {
    if (state.status !== "error" || !errorSignature) return;

    const failingFields = errorSignature.split(",");
    const earliestStep = Math.min(
      ...failingFields.map((field) => FIELD_STEP[field] ?? STEPS.length - 1),
    );
    setStep(earliestStep);

    const firstField = failingFields.find(
      (field) => (FIELD_STEP[field] ?? STEPS.length - 1) === earliestStep,
    );
    if (!firstField) return;

    requestAnimationFrame(() => {
      const control = formRef.current?.querySelector<HTMLElement>(
        `[name="${firstField}"]`,
      );
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    });
  }, [errorSignature, state.status]);

  const continueFromStep = () => {
    const controls = formRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`[data-trader-step="${step}"] input, [data-trader-step="${step}"] select, [data-trader-step="${step}"] textarea`);

    for (const control of controls ?? []) {
      if (!control.checkValidity()) {
        control.reportValidity();
        control.focus();
        return;
      }
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  return (
    <form action={formAction} className="grid gap-5" ref={formRef}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-bold text-[color:var(--px-text)]">
          {STEPS[step]}
        </h2>
        {/* Announced politely so a screen reader hears the step change. */}
        <p aria-live="polite" className="sr-only">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      {state.status === "error" && state.message ? (
        <FormNotice tone="error">{state.message}</FormNotice>
      ) : null}

      {/*
        Hidden rather than unmounted: unmounting would drop the answer from the
        submitted FormData, so going back a step would silently erase work.
      */}
      <div
        className={step === 0 ? "grid gap-4" : "hidden"}
        data-trader-step="0"
      >
        <Field
          error={fieldErrors.tradeCategory}
          hint="Pick the closest match. You can publish in others later."
          label="What do you want to trade?"
          name="tradeCategory"
        >
          <Select
            aria-invalid={Boolean(fieldErrors.tradeCategory)}
            defaultValue={defaults?.tradeCategory ?? categories[0]?.value}
            name="tradeCategory"
            required
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          error={fieldErrors.headline}
          hint="One line, in your own words."
          label="Describe it briefly"
          name="headline"
        >
          <Input
            aria-invalid={Boolean(fieldErrors.headline)}
            defaultValue={defaults?.headline}
            maxLength={140}
            minLength={10}
            name="headline"
            placeholder="e.g. Product design services for early-stage fintech"
            required
          />
        </Field>
      </div>

      <div
        className={step === 1 ? "grid gap-4" : "hidden"}
        data-trader-step="1"
      >
        <Field
          error={fieldErrors.applicantKind}
          label="Are you trading as an individual or a business?"
          name="applicantKind"
        >
          <Select
            aria-invalid={Boolean(fieldErrors.applicantKind)}
            defaultValue={defaults?.applicantKind ?? "INDIVIDUAL"}
            name="applicantKind"
            required
          >
            <option value="INDIVIDUAL">An individual</option>
            <option value="BUSINESS">A business</option>
          </Select>
        </Field>

        <Field
          error={fieldErrors.experience}
          hint="A couple of sentences is plenty."
          label="What relevant experience do you have?"
          name="experience"
        >
          <Textarea
            aria-invalid={Boolean(fieldErrors.experience)}
            defaultValue={defaults?.experience}
            maxLength={600}
            minLength={30}
            name="experience"
            placeholder="Tell us what you have done before, and who you usually work with."
            required
          />
        </Field>
      </div>

      <div
        className={isLast ? "grid gap-3" : "hidden"}
        data-trader-step="2"
      >
        <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">
          A reviewer checks that listings match what PerX allows. We do not ask
          for identity documents.
        </p>
        <ul className="grid gap-2 text-sm text-[color:var(--px-text-muted)]">
          <li>• Publish only opportunities you can genuinely deliver.</li>
          <li>• Keep terms accurate and honour what you agree.</li>
          <li>• Published content remains subject to PerX moderation.</li>
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button
            onClick={() => setStep((current) => current - 1)}
            type="button"
            variant="secondary"
          >
            Back
          </Button>
        ) : null}

        {isLast ? (
          <SubmitButton />
        ) : (
          <Button onClick={continueFromStep} type="button">
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}
