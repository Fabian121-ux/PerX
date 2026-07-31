import { beforeEach, describe, expect, it, vi } from "vitest";

const searchDataMocks = vi.hoisted(() => ({
  getPeopleDirectory: vi.fn(),
  opportunityFindMany: vi.fn(),
}));

vi.mock("@/lib/data/people", () => ({
  getPeopleDirectory: searchDataMocks.getPeopleDirectory,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    opportunity: { findMany: searchDataMocks.opportunityFindMany },
  }),
}));

import { OpportunityType } from "@/generated/prisma/enums";
import {
  getFeatureSearchResults,
  getUnifiedSearchResults,
} from "@/lib/data/search";
import { opportunityTypeOptions, opportunityTypeValues } from "@/lib/options";
import {
  buildSearchHref,
  formatSearchPriceRange,
  parseSearchCategory,
  parseSearchFilters,
  searchCategoryOptions,
} from "@/lib/search";
import { opportunityFormSchema } from "@/lib/validation/opportunity";

const validProduct = {
  budgetMax: "250000.00",
  budgetMin: "100000.00",
  category: "market",
  currency: "NGN",
  description:
    "A detailed description of the real product, its condition, delivery expectations, and the information a buyer needs before making an enquiry.",
  intent: "publish",
  location: "Lagos",
  remote: false,
  summary: "A real product available from a PerX member in Lagos.",
  title: "Professional production equipment",
  type: "PRODUCT",
};

describe("product opportunity contract", () => {
  it("keeps PRODUCT aligned across Prisma, options, and create validation", () => {
    expect(OpportunityType.PRODUCT).toBe("PRODUCT");
    expect(opportunityTypeValues).toContain("PRODUCT");
    expect(
      opportunityTypeOptions.filter((option) => option.value === "PRODUCT"),
    ).toEqual([{ label: "Product", value: "PRODUCT" }]);
    expect(opportunityFormSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects an inverted create-post budget range", () => {
    const result = opportunityFormSchema.safeParse({
      ...validProduct,
      budgetMax: "100.00",
      budgetMin: "200.00",
    });

    expect(result.success).toBe(false);
  });
});

describe("unified search parsing", () => {
  it("exposes only the supported categories and defaults invalid input to All", () => {
    expect(searchCategoryOptions.map((option) => option.label)).toEqual([
      "All",
      "People",
      "Products",
      "Services",
      "Features",
    ]);
    expect(parseSearchCategory(" PRODUCTS ")).toBe("products");
    expect(parseSearchCategory(["services", "people"])).toBe("services");
    expect(parseSearchCategory("unknown")).toBe("all");
    expect(parseSearchCategory(undefined)).toBe("all");
  });

  it("normalizes people and listing filters and parses NGN minor units", () => {
    const filters = parseSearchFilters({
      category: "all",
      location: " Lagos ",
      maxPrice: "5000",
      minPrice: "1000.25",
      q: " camera ",
      role: "property owner",
      skill: " sales ",
    });

    expect(filters).toMatchObject({
      category: "all",
      location: "Lagos",
      maxPriceMinor: 500000n,
      minPriceMinor: 100025n,
      priceError: null,
      q: "camera",
      role: "PROPERTY_OWNER",
      skill: "sales",
    });
    expect(formatSearchPriceRange(filters)).toBe("₦1,000.25 to ₦5,000");
  });

  it("rejects malformed and inverted listing price ranges", () => {
    expect(
      parseSearchFilters({
        category: "products",
        minPrice: "not-money",
      }).priceError,
    ).toMatch(/valid minimum price/i);
    expect(
      parseSearchFilters({
        category: "services",
        maxPrice: "100",
        minPrice: "200",
      }).priceError,
    ).toMatch(/cannot exceed/i);
  });

  it("builds category links without carrying a stale cursor", () => {
    const filters = parseSearchFilters({
      category: "people",
      cursor: "person-24",
      q: "designer",
    });

    expect(
      buildSearchHref(filters, { category: "products", cursor: null }),
    ).toBe("/app/search?category=products&q=designer");
  });
});

describe("unified search data integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchDataMocks.getPeopleDirectory.mockResolvedValue({
      nextCursor: "person-24",
      people: Array.from({ length: 10 }, (_, index) => ({
        id: `person-${index}`,
      })),
    });
    searchDataMocks.opportunityFindMany.mockImplementation(
      async (query: { take: number; where: { type: string } }) =>
        Array.from({ length: query.take }, (_, index) => ({
          id: `${query.where.type.toLocaleLowerCase()}-${index}`,
        })),
    );
  });

  it("runs bounded real-data branches for All", async () => {
    const filters = parseSearchFilters({
      category: "all",
      location: "Lagos",
      maxPrice: "5000",
      minPrice: "1000",
      q: "design",
      role: "FREELANCER",
      skill: "Figma",
    });
    const result = await getUnifiedSearchResults(
      { id: "viewer-1", roles: ["CLIENT"] },
      filters,
    );

    expect(searchDataMocks.getPeopleDirectory).toHaveBeenCalledWith(
      "viewer-1",
      expect.objectContaining({
        location: "Lagos",
        q: "design",
        role: "FREELANCER",
        skill: "Figma",
      }),
    );
    expect(searchDataMocks.opportunityFindMany).toHaveBeenCalledTimes(2);
    expect(searchDataMocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 7,
        where: expect.objectContaining({
          budgetMaxMinor: { lte: 500000n },
          budgetMinMinor: { gte: 100000n },
          currency: "NGN",
          location: { contains: "Lagos", mode: "insensitive" },
          type: "PRODUCT",
        }),
      }),
    );
    expect(searchDataMocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 7,
        where: expect.objectContaining({ currency: "NGN", type: "SERVICE" }),
      }),
    );
    expect(result.people?.items).toHaveLength(6);
    expect(result.products?.items).toHaveLength(6);
    expect(result.services?.items).toHaveLength(6);
    expect(result.features?.length).toBeLessThanOrEqual(6);
  });

  it("does not query listings when minimum price exceeds maximum price", async () => {
    const filters = parseSearchFilters({
      category: "products",
      maxPrice: "100",
      minPrice: "200",
    });

    const result = await getUnifiedSearchResults(
      { id: "viewer-1", roles: [] },
      filters,
    );

    expect(searchDataMocks.opportunityFindMany).not.toHaveBeenCalled();
    expect(result.products).toBeNull();
  });

  it("uses central feature registry content, including truthful Escrow wording", () => {
    const [escrow] = getFeatureSearchResults(
      "transaction protection",
      [],
      10,
    );

    expect(escrow).toMatchObject({
      id: "escrow",
      label: "Escrow",
    });
    expect(escrow.description).toBe(
      "Transaction protection is not yet available and is being prepared.",
    );
  });
});
