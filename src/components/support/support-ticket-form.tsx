"use client";

import { useActionState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormNotice } from "@/components/ui/form-notice";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  createSupportTicketAction,
  type SupportTicketFormState,
} from "@/features/support/actions";
import { supportCategoryOptions } from "@/lib/options";

const initialState: SupportTicketFormState = { status: "idle" };

export function SupportTicketForm() {
  const [state, formAction] = useActionState(
    createSupportTicketAction,
    initialState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state.message ? (
        <FormNotice tone="error">{state.message}</FormNotice>
      ) : null}
      <Field error={errors.subject} label="Subject" name="subject">
        <Input
          aria-describedby={errors.subject ? "subject-error" : undefined}
          aria-invalid={Boolean(errors.subject) || undefined}
          name="subject"
          placeholder="Briefly describe your issue"
          required
        />
      </Field>
      <Field error={errors.category} label="Category" name="category">
        <Select
          aria-describedby={errors.category ? "category-error" : undefined}
          aria-invalid={Boolean(errors.category) || undefined}
          name="category"
          required
        >
          <option value="">Select a category</option>
          {supportCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        error={errors.message}
        hint="Provide as much detail as possible to help us resolve your issue quickly."
        label="Message"
        name="message"
      >
        <Textarea
          aria-describedby={
            errors.message ? "message-hint message-error" : "message-hint"
          }
          aria-invalid={Boolean(errors.message) || undefined}
          className="min-h-32"
          name="message"
          placeholder="Describe your issue in detail..."
          required
        />
      </Field>
      <div className="flex justify-end pt-2">
        <PendingSubmitButton pendingLabel="Sending request..." type="submit">
          Submit Ticket
        </PendingSubmitButton>
      </div>
    </form>
  );
}
