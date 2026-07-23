import { beforeEach, describe, expect, it } from "vitest";

import { validateProfileImageFile } from "@/lib/uploads/profile-image";

describe("profile image upload validation", () => {
  beforeEach(() => {
    process.env.UPLOAD_MAX_BYTES = String(1024);
  });

  it("accepts approved image MIME types and extensions", () => {
    const file = new File(["avatar"], "avatar.webp", { type: "image/webp" });
    expect(validateProfileImageFile(file)).toMatchObject({ extension: "webp" });
  });

  it("rejects disguised executable uploads", () => {
    const file = new File(["bad"], "avatar.exe", { type: "image/png" });
    expect(validateProfileImageFile(file)).toMatchObject({
      error: "Use a JPEG, PNG, or WebP image.",
    });
  });

  it("rejects oversized images", () => {
    const file = new File(["x".repeat(2048)], "avatar.png", { type: "image/png" });
    expect(validateProfileImageFile(file)).toMatchObject({
      error: "Profile images must be 1 KB or smaller.",
    });
  });
});
