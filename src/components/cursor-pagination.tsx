import { ButtonLink } from "@/components/ui/button";

export function CursorPagination({
  basePath,
  cursor,
  label,
  nextCursor,
}: {
  basePath: string;
  cursor?: string | null;
  label: string;
  nextCursor?: string | null;
}) {
  if (!cursor && !nextCursor) return null;

  return (
    <nav
      aria-label={label}
      className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"
    >
      {cursor ? (
        <ButtonLink href={basePath} variant="secondary">
          First page
        </ButtonLink>
      ) : null}
      {nextCursor ? (
        <ButtonLink
          href={`${basePath}?cursor=${encodeURIComponent(nextCursor)}`}
          variant="secondary"
        >
          Next
        </ButtonLink>
      ) : null}
    </nav>
  );
}
