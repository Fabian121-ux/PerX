/** Content reports reuse the existing OTHER_CONTENT moderation type.
 * Prefixes distinguish posts from comments without introducing a migration.
 */
export type SocialReportContentKind = "POST" | "COMMENT";

export function socialContentReportTarget(kind: SocialReportContentKind, id: string) {
  return `${kind}:${id}`;
}

export function parseSocialContentReportTarget(value: string):
  | { kind: SocialReportContentKind; id: string }
  | null {
  // Prisma cuid IDs are untrusted until revalidated against viewer-scoped data.
  const parsed = /^(POST|COMMENT):([a-zA-Z0-9_-]{1,64})$/.exec(value);
  if (!parsed) return null;
  return {
    kind: parsed[1] as SocialReportContentKind,
    id: parsed[2]!,
  };
}
