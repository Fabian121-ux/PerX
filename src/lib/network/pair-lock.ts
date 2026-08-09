type PairLockClient = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export async function lockUserPair(
  tx: PairLockClient,
  firstUserId: string,
  secondUserId: string,
) {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    pairKey(firstUserId, secondUserId),
  );
}

export async function lockUserAccount(tx: PairLockClient, userId: string) {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    `account:${userId}`,
  );
}

export async function lockUserPairs(
  tx: PairLockClient,
  currentUserId: string,
  otherUserIds: string[],
) {
  const keys = [
    ...new Set(
      otherUserIds
        .filter((userId) => userId !== currentUserId)
        .map((userId) => pairKey(currentUserId, userId)),
    ),
  ].sort();
  for (const key of keys) {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      key,
    );
  }
}
