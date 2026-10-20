// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  getServerEnv: vi.fn(() => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://storage.example.test",
    SUPABASE_MESSAGE_BUCKET: "message-images",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret",
  })),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: env.getServerEnv }));

import {
  isValidStoredMessageImageKey,
  uploadMessageImage,
  validateMessageImage,
} from "@/lib/uploads/message-image";

function file(name: string, type: string, header: number[]) {
  return new File([new Uint8Array(header)], name, { type });
}

describe("private chat image validation and storage", () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("accepts recognized signatures and rejects forged, invalid and executable content", async () => {
    const png = file("view.png", "image/png", [137,80,78,71,13,10,26,10,0,0,0,0]);
    expect(await validateMessageImage(png)).toEqual({ extension: "png" });
    const jpeg = file("view.jpg", "image/jpeg", [255,216,255,0,0,0]);
    expect(await validateMessageImage(jpeg)).toEqual({ extension: "jpg" });
    const webp = file("view.webp", "image/webp", [82,73,70,70,0,0,0,0,87,69,66,80]);
    expect(await validateMessageImage(webp)).toEqual({ extension: "webp" });
    expect(await validateMessageImage(file("fake.jpg","image/jpeg",[0,1,2,3]))).toMatchObject({ error: expect.any(String) });
    expect(await validateMessageImage(file("execute.svg","image/svg+xml",[60,115,118,103]))).toMatchObject({ error: expect.any(String) });
    expect(await validateMessageImage(file("wrong.txt","image/png",[137,80,78,71,13,10,26,10]))).toMatchObject({ error: expect.any(String) });
  });

  it("does not produce public URLs or expose storage secrets to clients", async () => {
    const mockedFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockedFetch);
    const name = await uploadMessageImage({
      file: file("photo.jpg","image/jpeg",[255,216,255,0]),
      extension: "jpg", conversationId: "c123", userId: "u456",
    });
    expect(name).toMatch(/^messages\/c123\/u456\/[0-9a-f-]+\.jpg$/);
    expect(isValidStoredMessageImageKey(name, "c123")).toBe(true);
    expect(isValidStoredMessageImageKey(name, "other")).toBe(false);
    expect(isValidStoredMessageImageKey("https://example.test/public/bucket/photo.jpg", "c123")).toBe(false);
    expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining(
      "/storage/v1/object/message-images/messages/c123/u456/"
    ), expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer server-secret", "x-upsert": "false" }),
    }));
    expect(name).not.toContain("server-secret");
  });
});
