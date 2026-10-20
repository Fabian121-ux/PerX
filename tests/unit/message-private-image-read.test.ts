import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  downloadMessageImage: vi.fn(),
  configured: vi.fn(),
}));
const db = vi.hoisted(() => ({
  messageAttachment: { findFirst: vi.fn() },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => db }));
vi.mock("@/lib/uploads/message-image", () => ({
  downloadMessageImage: mocks.downloadMessageImage,
  isMessageImageStorageConfigured: mocks.configured,
  isValidStoredMessageImageKey: vi.fn((key: string) => key.startsWith("messages/")),
}));

import { GET } from "@/app/api/messages/images/[attachmentId]/route";

const attachmentId = "cl01234567890123456789012";
const path = "messages/cl01234567890123456789011/user123/11111111-1111-4111-8111-111111111111.jpg";

function get() {
  return GET(new Request("https://example.test/api/messages/images/" + attachmentId), {
    params: Promise.resolve({ attachmentId }),
  });
}

describe("protected private photo reading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.getCurrentUser.mockResolvedValue({ id: "user1" });
    db.messageAttachment.findFirst.mockResolvedValue({
      byteSize: 300,
      mimeType: "image/jpeg",
      message: { conversationId: "cl01234567890123456789011" },
      url: path,
    });
    mocks.downloadMessageImage.mockResolvedValue(
      new Response(new Uint8Array([255,216,255]), { status: 200 }),
    );
  });

  it("never fetches a photo without a signed-in viewer", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);
    expect(db.messageAttachment.findFirst).not.toHaveBeenCalled();
    expect(mocks.downloadMessageImage).not.toHaveBeenCalled();
  });

  it("enforces active conversation access, blocks, deletion and approved state", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(db.messageAttachment.findFirst).toHaveBeenCalledWith({
      select: {
        byteSize: true,
        mimeType: true,
        url: true,
        message: { select: { conversationId: true } },
      },
      where: expect.objectContaining({
        id: attachmentId,
        status: "APPROVED",
        message: expect.objectContaining({
          deletedAt: null,
          conversation: expect.objectContaining({
            participants: expect.objectContaining({
              some: expect.objectContaining({ userId: "user1", removedAt: null }),
              none: expect.any(Object),
            }),
          }),
        }),
      }),
    });
  });

  it("does not fetch private Storage when an attachment ID is no longer accessible", async () => {
    db.messageAttachment.findFirst.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(404);
    expect(mocks.downloadMessageImage).not.toHaveBeenCalled();
  });

  it("refuses mismatched object keys and unsupported content types", async () => {
    db.messageAttachment.findFirst.mockResolvedValueOnce({
      byteSize: 300,
      mimeType: "image/svg+xml",
      message: { conversationId: "cl01234567890123456789011" },
      url: path,
    });
    expect((await get()).status).toBe(404);
    expect(mocks.downloadMessageImage).not.toHaveBeenCalled();
  });
});
