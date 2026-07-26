import { beforeEach, describe, expect, it } from "vitest";

import { validateListingImageFile } from "@/lib/uploads/listing-image";

describe("listing image upload validation", () => {
  beforeEach(() => {
    process.env.UPLOAD_MAX_BYTES = String(1024);
  });

  it("accepts approved listing image MIME types and extensions", () => {
    const file = new File(["listing"], "property.jpeg", { type: "image/jpeg" });

    expect(validateListingImageFile(file)).toMatchObject({ extension: "jpg" });
  });

  it("rejects disguised or unsupported listing images", () => {
    const file = new File(["bad"], "property.png.exe", { type: "image/png" });

    expect(validateListingImageFile(file)).toMatchObject({
      error: "Use a JPEG, PNG, or WebP image.",
    });
  });

  it("rejects empty and oversized listing images", () => {
    const emptyFile = new File([], "empty.webp", { type: "image/webp" });
    const largeFile = new File(["x".repeat(2048)], "large.png", { type: "image/png" });

    expect(validateListingImageFile(emptyFile)).toMatchObject({
      error: "Choose a non-empty image file.",
    });
    expect(validateListingImageFile(largeFile)).toMatchObject({
      error: "Listing images must be 1 KB or smaller.",
    });
  });
});
