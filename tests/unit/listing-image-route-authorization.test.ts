import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanPublish: vi.fn(),
  getCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/account/enforcement", () => ({
  assertCanPublish: mocks.assertCanPublish,
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/lib/uploads/listing-image", () => ({
  deleteListingImage: vi.fn(),
  isListingImageStorageConfigured: vi.fn(() => true),
  uploadListingImage: vi.fn(),
  validateListingImageFile: vi.fn(),
}));

import {
  DELETE,
  PATCH,
  POST,
} from "@/app/api/opportunities/[opportunityId]/images/route";

describe("listing image route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "member-1", roles: ["MEMBER"] });
  });

  it.each([
    ["POST", POST],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ])("requires opportunity update capability for %s", async (method, handler) => {
    const response = await handler(
      new Request("http://localhost/api/opportunities/opportunity-1/images", {
        method,
      }),
      { params: Promise.resolve({ opportunityId: "opportunity-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden." });
    expect(mocks.assertCanPublish).not.toHaveBeenCalled();
    expect(mocks.getPrisma).not.toHaveBeenCalled();
  });
});
