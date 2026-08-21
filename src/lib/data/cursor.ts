export const DEFAULT_CURSOR_PAGE_SIZE = 20;
export const MAX_CURSOR_PAGE_SIZE = 50;

export type CursorPageParams = {
  cursor?: string;
  pageSize?: number;
};

export type CursorPage<T> = {
  cursor: string | null;
  items: T[];
  nextCursor: string | null;
  pageSize: number;
};

export type CursorToken = {
  id: string;
  scope?: string;
  timestamp: Date;
};

/**
 * Timestamp columns a keyset cursor may sort on.
 *
 * `publishedAt` is nullable on `Opportunity`, so any query using it must also
 * constrain `publishedAt: { not: null }` (as `buildPublicOpportunityWhere`
 * does). Without that, NULL rows sort unpredictably and the keyset comparison
 * silently drops them.
 */
export type CursorField = "createdAt" | "publishedAt" | "updatedAt";

type CursorPayload = {
  id?: unknown;
  scope?: unknown;
  timestamp?: unknown;
  version?: unknown;
};

export function clampCursorPageSize(pageSize?: number) {
  if (pageSize === undefined || !Number.isFinite(pageSize)) {
    return DEFAULT_CURSOR_PAGE_SIZE;
  }

  return Math.max(1, Math.min(Math.trunc(pageSize), MAX_CURSOR_PAGE_SIZE));
}

export function encodeCursor({
  id,
  scope,
  timestamp,
}: {
  id: string;
  scope?: string;
  timestamp: Date | string;
}) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!id || Number.isNaN(date.getTime())) {
    throw new Error("Cannot encode an invalid cursor.");
  }

  return Buffer.from(
    JSON.stringify({
      id,
      ...(scope ? { scope } : {}),
      timestamp: date.toISOString(),
      version: 1,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeCursor(value?: string): CursorToken | null {
  const normalized = value?.trim();
  if (
    !normalized ||
    normalized.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(normalized)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(normalized, "base64url").toString("utf8"),
    ) as CursorPayload;
    if (
      payload.version !== 1 ||
      typeof payload.id !== "string" ||
      !payload.id ||
      typeof payload.timestamp !== "string"
    ) {
      return null;
    }

    const timestamp = new Date(payload.timestamp);
    if (Number.isNaN(timestamp.getTime())) return null;
    if (payload.scope !== undefined && typeof payload.scope !== "string") {
      return null;
    }

    return {
      id: payload.id,
      ...(payload.scope ? { scope: payload.scope } : {}),
      timestamp,
    };
  } catch {
    return null;
  }
}

export function normalizeCursorPageParams(
  params?: CursorPageParams,
  expectedScope?: string,
) {
  const requestedCursor = params?.cursor?.trim();
  const cursor = decodeCursor(requestedCursor);

  if (requestedCursor && !cursor) {
    throw new Error("Invalid cursor.");
  }
  if (cursor && expectedScope && cursor.scope !== expectedScope) {
    throw new Error("Invalid cursor scope.");
  }

  return {
    cursor,
    pageSize: clampCursorPageSize(params?.pageSize),
    requestedCursor: cursor ? (requestedCursor ?? null) : null,
  };
}

export function buildCursorPredicate(
  cursor: CursorToken,
  {
    direction,
    field,
  }: {
    direction: "asc" | "desc";
    field: CursorField;
  },
) {
  const operator = direction === "desc" ? "lt" : "gt";

  return {
    OR: [
      { [field]: { [operator]: cursor.timestamp } },
      { [field]: cursor.timestamp, id: { [operator]: cursor.id } },
    ],
  };
}

export function withCursor<T extends object>(
  where: T,
  cursor: CursorToken | null,
  options: {
    direction: "asc" | "desc";
    field: CursorField;
  },
) {
  if (!cursor) return where;

  return {
    AND: [where, buildCursorPredicate(cursor, options)],
  } as T;
}

export function createCursorPage<T extends { id: string }>(
  items: T[],
  {
    cursor,
    getTimestamp,
    hasNextPage,
    nextCursorItem,
    pageSize,
    scope,
  }: {
    cursor: string | null;
    getTimestamp: (item: T) => Date | string;
    hasNextPage: boolean;
    nextCursorItem?: T;
    pageSize: number;
    scope?: string;
  },
): CursorPage<T> {
  const cursorItem = nextCursorItem ?? items.at(-1);

  return {
    cursor,
    items,
    nextCursor:
      hasNextPage && cursorItem
        ? encodeCursor({
            id: cursorItem.id,
            scope,
            timestamp: getTimestamp(cursorItem),
          })
        : null,
    pageSize,
  };
}
