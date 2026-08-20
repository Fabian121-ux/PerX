import { Flag } from "lucide-react";

import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { submitUserReportAction } from "@/features/reports/actions";
import { requireUser } from "@/lib/auth/session";
import { reportReasonOptions } from "@/lib/options";

const targetLabels: Record<string, string> = {
  CONVERSATION: "conversation",
  DEAL: "deal",
  MESSAGE: "message",
  OPPORTUNITY: "opportunity",
  OTHER_CONTENT: "content",
  // Retained so legacy PROPERTY listings remain reportable; the label no
  // longer names the retired vertical.
  REAL_ESTATE_LISTING: "property listing",
  REVIEW: "review",
  USER: "user",
};

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    conversationId?: string;
    error?: string;
    messageId?: string;
    targetId?: string;
    targetType?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;
  const targetType = params.targetType ?? "";
  const targetId = params.targetId ?? "";

  if (!targetType || !targetId || !targetLabels[targetType]) {
    return (
      <AppSection
        description="Reports must start from the specific profile, message, deal, or listing you can access."
        title="Submit report"
      >
        <EmptyState
          action={<ButtonLink href="/app/reports">View my reports</ButtonLink>}
          body="Open the item you want to report and choose Report from its action menu."
          title="Choose an item first"
        />
      </AppSection>
    );
  }

  return (
    <AppSection
      description="Tell PerX what needs review. Internal moderation notes stay private."
      title={`Report ${targetLabels[targetType]}`}
    >
      <Card className="max-w-2xl">
        {params.error ? (
          <div className="mb-4 rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700">
            {params.error === "unavailable"
              ? "This item is no longer available or you do not have access to it."
              : "Please check the report details and try again."}
          </div>
        ) : null}
        <form action={submitUserReportAction} className="grid gap-4">
          <input name="targetType" type="hidden" value={targetType} />
          <input name="targetId" type="hidden" value={targetId} />
          <input
            name="contextConversationId"
            type="hidden"
            value={params.conversationId ?? ""}
          />
          <input
            name="contextMessageId"
            type="hidden"
            value={params.messageId ?? ""}
          />

          <div className="flex items-start gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
              <Flag aria-hidden size={18} />
            </span>
            <div>
              <h2 className="font-bold text-[color:var(--px-text)]">
                Moderation review
              </h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
                The report will include the target identifier and safe context.
                Do not include passwords, payment secrets, or private documents
                in the details field.
              </p>
            </div>
          </div>

          <Field label="Reason">
            <Select name="category" required>
              {reportReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Additional details">
            <Textarea
              maxLength={1200}
              name="details"
              placeholder="Add a short explanation for the moderation team."
            />
          </Field>
          {["CONVERSATION", "MESSAGE", "USER"].includes(targetType) ? (
            <label className="flex items-start gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 text-sm text-[color:var(--px-text)]">
              <input
                className="mt-1 h-4 w-4 rounded border-[color:var(--px-border)]"
                name="blockAfterReport"
                type="checkbox"
              />
              <span>
                <span className="block font-bold">Report and block</span>
                <span className="block text-[color:var(--px-text-muted)]">
                  Blocking is personal to your account. It does not suspend the
                  other user globally.
                </span>
              </span>
            </label>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" type="submit">
              Submit report
            </Button>
            <ButtonLink
              className="w-full sm:w-auto"
              href="/app/reports"
              variant="secondary"
            >
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </AppSection>
  );
}
