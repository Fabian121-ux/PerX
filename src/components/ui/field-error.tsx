/**
 * Field-level validation message.
 *
 * The sign-up form already established this pattern (an `id` the control points
 * at via `aria-describedby`, plus `aria-invalid` on the control itself), but it
 * was private to that file. Lifting it here means the composer can reuse the
 * exact same semantics rather than inventing a second convention.
 *
 * Renders nothing without a message so callers can pass a possibly-undefined
 * error without guarding at every call site.
 */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;

  return (
    <span
      className="text-xs font-semibold leading-5 text-red-700 dark:text-red-300"
      id={id}
    >
      {message}
    </span>
  );
}

/**
 * Wiring for a control that can fail validation.
 *
 * Returns the ids and ARIA attributes to spread onto the input. Centralised
 * because getting `aria-describedby` right - omitting it entirely when there is
 * no hint and no error, rather than emitting an empty string that points at
 * nothing - is easy to get subtly wrong per field.
 */
export function fieldErrorProps({
  error,
  hasHint,
  name,
}: {
  error?: string;
  hasHint?: boolean;
  name: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [hasHint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": Boolean(error) || undefined,
    errorId,
    hintId,
  };
}
