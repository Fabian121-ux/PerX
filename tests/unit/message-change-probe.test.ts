import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregateMessage = vi.fn();
const aggregateParticipant = vi.fn();
const findFirstConversation = vi.fn();
const findManyConversation = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversation: {
      findFirst: findFirstConversation,
      findMany: findManyConversation,
    },
    conversationParticipant: { aggregate: aggregateParticipant },
    message: { aggregate: aggregateMessage },
  }),
}));

const { getMessageChangeMarker, probeMessageChanges } =
  await import("@/lib/messages/change-probe");

function setConversationState({
  createdAt = new Date("2026-01-01T00:00:00Z"),
  count = 3,
  deletedAt = null,
  editedAt = null,
  lastReadAt = null,
  updatedAt = new Date("2026-01-01T00:00:00Z"),
}: {
  createdAt?: Date | null;
  count?: number;
  deletedAt?: Date | null;
  editedAt?: Date | null;
  lastReadAt?: Date | null;
  updatedAt?: Date;
}) {
  findFirstConversation.mockResolvedValue({ id: "conv-1", updatedAt });
  aggregateMessage.mockResolvedValue({
    _count: { _all: count },
    _max: { createdAt, deletedAt, editedAt },
  });
  aggregateParticipant.mockResolvedValue({ _max: { lastReadAt } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("message change probe", () => {
  it("returns a stable marker when nothing changes", async () => {
    setConversationState({});
    const first = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    setConversationState({});
    const second = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    expect(first.version).toBe(second.version);
    expect(first.version).not.toBe("");
  });

  it("detects a new message", async () => {
    setConversationState({});
    const before = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    setConversationState({
      count: 4,
      createdAt: new Date("2026-01-01T00:05:00Z"),
      updatedAt: new Date("2026-01-01T00:05:00Z"),
    });
    const after = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    expect(after.version).not.toBe(before.version);
  });

  it("detects a message edit", async () => {
    setConversationState({});
    const before = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    // An edit updates only the Message row, so conversation.updatedAt and the
    // message count both stay put.
    setConversationState({ editedAt: new Date("2026-01-01T00:07:00Z") });
    const after = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    expect(after.version).not.toBe(before.version);
  });

  it("detects a soft delete even though conversation.updatedAt is untouched", async () => {
    // This is the case a naive `updatedAt` marker misses: verified directly
    // against the database, deleting a message leaves the conversation row
    // unchanged. A marker that missed it would make degraded mode lossy.
    setConversationState({});
    const before = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    setConversationState({ deletedAt: new Date("2026-01-01T00:09:00Z") });
    const after = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    expect(after.version).not.toBe(before.version);
  });

  it("detects read-state movement", async () => {
    setConversationState({});
    const before = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    setConversationState({ lastReadAt: new Date("2026-01-01T00:11:00Z") });
    const after = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    expect(after.version).not.toBe(before.version);
  });

  it("reports unauthorized without disclosing existence", async () => {
    findFirstConversation.mockResolvedValue(null);
    const result = await probeMessageChanges({
      conversationId: "conv-secret",
      since: "anything",
      userId: "user-1",
    });
    expect(result.authorized).toBe(false);
    expect(result.version).toBe("");
    expect(result.changed).toBe(false);
    // No aggregate should run for a conversation the viewer cannot see.
    expect(aggregateMessage).not.toHaveBeenCalled();
  });

  it("treats a missing since value as changed", async () => {
    setConversationState({});
    const result = await probeMessageChanges({
      conversationId: "conv-1",
      since: null,
      userId: "user-1",
    });
    expect(result.changed).toBe(true);
  });

  it("reports unchanged when the marker matches", async () => {
    setConversationState({});
    const { version } = await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    setConversationState({});
    const result = await probeMessageChanges({
      conversationId: "conv-1",
      since: version,
      userId: "user-1",
    });
    expect(result.changed).toBe(false);
  });

  it("stays cheap: a scoped probe issues a bounded number of queries", async () => {
    setConversationState({});
    await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    const queries =
      findFirstConversation.mock.calls.length +
      findManyConversation.mock.calls.length +
      aggregateMessage.mock.calls.length +
      aggregateParticipant.mock.calls.length;
    // Authorization + message aggregate + participant aggregate.
    expect(queries).toBeLessThanOrEqual(3);
  });

  it("never selects message bodies or profile graphs", async () => {
    setConversationState({});
    await getMessageChangeMarker({
      conversationId: "conv-1",
      userId: "user-1",
    });
    const serialized = JSON.stringify([
      ...findFirstConversation.mock.calls,
      ...aggregateMessage.mock.calls,
      ...aggregateParticipant.mock.calls,
    ]);
    expect(serialized).not.toContain("body");
    expect(serialized).not.toContain("sender");
    expect(serialized).not.toContain("profile");
    expect(serialized).not.toContain("include");
  });

  it("bounds the list-scope probe to the loaded conversation window", async () => {
    findManyConversation.mockResolvedValue([
      { id: "a", updatedAt: new Date("2026-01-01T00:00:00Z") },
    ]);
    aggregateMessage.mockResolvedValue({
      _count: { _all: 1 },
      _max: { createdAt: null, deletedAt: null, editedAt: null },
    });
    aggregateParticipant.mockResolvedValue({ _max: { lastReadAt: null } });

    await getMessageChangeMarker({ conversationId: null, userId: "user-1" });
    const call = findManyConversation.mock.calls[0]?.[0] as {
      take?: number;
    };
    expect(typeof call.take).toBe("number");
    expect(call.take).toBeLessThanOrEqual(51);
  });
});
