import type { ReactNode } from "react";

/**
 * Inline status banner for form and page-level messages.
 *
 * Exists because the auth surface had grown three incompatible dialects for
 * what is visually the same element: `rounded` + `green-*` with no ARIA role,
 * `rounded-md` + `emerald-*`, and `rounded-[var(--px-radius-sm)]` + `red-*`.
 * Centralising them keeps a single radius, one palette per tone, and - most
 * importantly - a correct role every time.
 *
 * Tone drives the announcement: `error` is assertive because the user is
 * blocked, while `success` and `info` are polite so they never interrupt a
 * screen reader mid-sentence.
 *
 * Colours follow the toast convention (`feedback-provider`): an alpha-based
 * background over the themed surface plus an explicit `dark:` text variant.
 * Flat palette literals such as `bg-green-50` are avoided deliberately - they
 * are unaffected by the `.dark` class, so they render a light banner on a dark
 * card.
 */
export type FormNoticeTone = "error" | "info" | "success" | "warning";

const TONE_CLASSES: Record<FormNoticeTone, string> = {
  error: "bg-red-500/12 text-red-700 dark:text-red-300",
  info: "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/14 text-amber-800 dark:text-amber-200",
};

export function FormNotice({
  children,
  className,
  tone = "info",
}: {
  children: ReactNode;
  className?: string;
  tone?: FormNoticeTone;
}) {
  return (
    <div
      className={`rounded-[var(--px-radius-sm)] p-3 text-sm font-semibold ${TONE_CLASSES[tone]}${
        className ? ` ${className}` : ""
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
