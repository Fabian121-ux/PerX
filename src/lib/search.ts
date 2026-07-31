import { formatMoney, parseMoneyToMinor } from "@/lib/money";

export const searchCategoryOptions = [
  { label: "All", value: "all" },
  { label: "People", value: "people" },
  { label: "Products", value: "products" },
  { label: "Services", value: "services" },
  { label: "Features", value: "features" },
] as const;

export type SearchCategory = (typeof searchCategoryOptions)[number]["value"];

type SearchParamValue = string | string[] | undefined;

export type SearchQueryParams = {
  category?: SearchParamValue;
  cursor?: SearchParamValue;
  location?: SearchParamValue;
  maxPrice?: SearchParamValue;
  minPrice?: SearchParamValue;
  q?: SearchParamValue;
  role?: SearchParamValue;
  skill?: SearchParamValue;
};

export type ParsedSearchFilters = {
  category: SearchCategory;
  cursor?: string;
  location?: string;
  maxPrice?: string;
  maxPriceMinor?: bigint;
  minPrice?: string;
  minPriceMinor?: bigint;
  priceError: string | null;
  q?: string;
  role?: string;
  skill?: string;
};

const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n;
const searchCategoryValues = new Set<SearchCategory>(
  searchCategoryOptions.map((option) => option.value),
);

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeText(value: SearchParamValue, maxLength: number) {
  const normalized = firstValue(value)?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function parsePrice(value: string | undefined) {
  if (!value || value.length > 18) return undefined;

  try {
    const amountMinor = parseMoneyToMinor(value, "NGN").amountMinor;
    return amountMinor <= MAX_DATABASE_BIGINT ? amountMinor : undefined;
  } catch {
    return undefined;
  }
}

export function parseSearchCategory(value: SearchParamValue): SearchCategory {
  const normalized = firstValue(value)?.trim().toLocaleLowerCase();
  return normalized && searchCategoryValues.has(normalized as SearchCategory)
    ? (normalized as SearchCategory)
    : "all";
}

export function parseSearchFilters(
  params: SearchQueryParams = {},
): ParsedSearchFilters {
  const category = parseSearchCategory(params.category);
  const minPrice = normalizeText(params.minPrice, 32);
  const maxPrice = normalizeText(params.maxPrice, 32);
  const usesPriceFilters = ["all", "products", "services"].includes(category);
  const minPriceMinor = usesPriceFilters ? parsePrice(minPrice) : undefined;
  const maxPriceMinor = usesPriceFilters ? parsePrice(maxPrice) : undefined;
  let priceError: string | null = null;

  if (usesPriceFilters && minPrice && minPriceMinor === undefined) {
    priceError = "Enter a valid minimum price in NGN.";
  } else if (usesPriceFilters && maxPrice && maxPriceMinor === undefined) {
    priceError = "Enter a valid maximum price in NGN.";
  } else if (
    minPriceMinor !== undefined &&
    maxPriceMinor !== undefined &&
    minPriceMinor > maxPriceMinor
  ) {
    priceError = "Minimum price cannot exceed maximum price.";
  }

  return {
    category,
    cursor: normalizeText(params.cursor, 128),
    location: normalizeText(params.location, 100),
    maxPrice,
    maxPriceMinor,
    minPrice,
    minPriceMinor,
    priceError,
    q: normalizeText(params.q, 100),
    role: normalizeText(params.role, 80)?.toUpperCase().replaceAll(" ", "_"),
    skill: normalizeText(params.skill, 80),
  };
}

export function formatSearchPriceRange(filters: ParsedSearchFilters) {
  if (
    filters.minPriceMinor !== undefined &&
    filters.maxPriceMinor !== undefined
  ) {
    return `${formatMoney(filters.minPriceMinor, "NGN")} to ${formatMoney(filters.maxPriceMinor, "NGN")}`;
  }
  if (filters.minPriceMinor !== undefined) {
    return `From ${formatMoney(filters.minPriceMinor, "NGN")}`;
  }
  if (filters.maxPriceMinor !== undefined) {
    return `Up to ${formatMoney(filters.maxPriceMinor, "NGN")}`;
  }
  return null;
}

export function buildSearchHref(
  filters: ParsedSearchFilters,
  overrides: { category?: SearchCategory; cursor?: string | null } = {},
) {
  const params = new URLSearchParams();
  const category = overrides.category ?? filters.category;
  const cursor = Object.hasOwn(overrides, "cursor")
    ? (overrides.cursor ?? undefined)
    : filters.cursor;
  const values = {
    category,
    cursor,
    location: filters.location,
    maxPrice: filters.maxPrice,
    minPrice: filters.minPrice,
    q: filters.q,
    role: filters.role,
    skill: filters.skill,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }

  return `/app/search?${params.toString()}`;
}
