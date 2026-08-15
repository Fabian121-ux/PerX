import {
  contactPreferenceValues,
  currencyValues,
  opportunityCategoryValues,
  opportunityTypeValues,
  propertyListingTypeValues,
  propertyTypeValues,
} from "@/lib/options";

export const OPPORTUNITY_COMPOSER_DRAFT_VERSION = 1;
export const OPPORTUNITY_COMPOSER_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const maxDraftBytes = 16_000;

export type CreatableOpportunityType = Exclude<
  (typeof opportunityTypeValues)[number],
  "INVESTMENT"
>;

export type OpportunityComposerDraftFields = {
  budgetMax: string;
  budgetMin: string;
  category: (typeof opportunityCategoryValues)[number];
  contactPreference: "" | (typeof contactPreferenceValues)[number];
  currency: (typeof currencyValues)[number];
  description: string;
  listingRulesAccepted: boolean;
  location: string;
  propertyListingType: "" | (typeof propertyListingTypeValues)[number];
  propertyType: "" | (typeof propertyTypeValues)[number];
  remote: boolean;
  skills: string;
  summary: string;
  title: string;
};

export type OpportunityComposerDraft = {
  fields: OpportunityComposerDraftFields;
  savedAt: number;
  type: CreatableOpportunityType;
  version: typeof OPPORTUNITY_COMPOSER_DRAFT_VERSION;
};

const creatableTypes = new Set<string>(
  opportunityTypeValues.filter((value) => value !== "INVESTMENT"),
);
const categories = new Set<string>(opportunityCategoryValues);
const currencies = new Set<string>(currencyValues);
const contactPreferences = new Set<string>(contactPreferenceValues);
const propertyListingTypes = new Set<string>(propertyListingTypeValues);
const propertyTypes = new Set<string>(propertyTypeValues);

export function isCreatableOpportunityType(
  value: unknown,
): value is CreatableOpportunityType {
  return typeof value === "string" && creatableTypes.has(value);
}

export function getOpportunityComposerDraftKey(
  userId: string,
  type: unknown,
) {
  if (!userId || userId.length > 128 || !isCreatableOpportunityType(type)) {
    return null;
  }
  return `perx:opportunity-composer:v${OPPORTUNITY_COMPOSER_DRAFT_VERSION}:${encodeURIComponent(userId)}:${type}`;
}

export function readOpportunityComposerDraft(
  userId: string,
  type: unknown,
  now = Date.now(),
): OpportunityComposerDraft | null {
  const key = getOpportunityComposerDraftKey(userId, type);
  const storage = getLocalStorage();
  if (!key || !storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
    if (!raw) return null;
    if (raw.length > maxDraftBytes) {
      removeDraft(storage, key);
      return null;
    }
    const draft = normalizeDraft(JSON.parse(raw), type, now);
    if (!draft) removeDraft(storage, key);
    return draft;
  } catch {
    if (raw !== null) removeDraft(storage, key);
    return null;
  }
}

export function writeOpportunityComposerDraft(
  userId: string,
  type: CreatableOpportunityType,
  fields: OpportunityComposerDraftFields,
  now = Date.now(),
) {
  const key = getOpportunityComposerDraftKey(userId, type);
  const storage = getLocalStorage();
  const normalizedFields = normalizeFields(fields);
  if (!key || !storage || !normalizedFields) return false;
  const value = JSON.stringify({
    fields: normalizedFields,
    savedAt: now,
    type,
    version: OPPORTUNITY_COMPOSER_DRAFT_VERSION,
  });
  if (value.length > maxDraftBytes) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function clearOpportunityComposerDraft(
  userId: string,
  type: unknown,
) {
  const key = getOpportunityComposerDraftKey(userId, type);
  const storage = getLocalStorage();
  if (!key || !storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function normalizeDraft(
  value: unknown,
  expectedType: unknown,
  now: number,
): OpportunityComposerDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Partial<OpportunityComposerDraft>;
  if (
    draft.version !== OPPORTUNITY_COMPOSER_DRAFT_VERSION ||
    draft.type !== expectedType ||
    !isCreatableOpportunityType(draft.type) ||
    typeof draft.savedAt !== "number" ||
    !Number.isFinite(draft.savedAt) ||
    draft.savedAt > now + 60_000 ||
    now - draft.savedAt > OPPORTUNITY_COMPOSER_DRAFT_MAX_AGE_MS
  ) {
    return null;
  }
  const fields = normalizeFields(draft.fields);
  return fields
    ? {
        fields,
        savedAt: draft.savedAt,
        type: draft.type,
        version: OPPORTUNITY_COMPOSER_DRAFT_VERSION,
      }
    : null;
}

function normalizeFields(
  value: unknown,
): OpportunityComposerDraftFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  const title = boundedString(fields.title, 140);
  const summary = boundedString(fields.summary, 260);
  const description = boundedString(fields.description, 4000);
  const budgetMin = boundedString(fields.budgetMin, 24);
  const budgetMax = boundedString(fields.budgetMax, 24);
  const location = boundedString(fields.location, 120);
  const skills = boundedString(fields.skills, 500);
  if (
    title === null ||
    summary === null ||
    description === null ||
    budgetMin === null ||
    budgetMax === null ||
    location === null ||
    skills === null ||
    !categories.has(String(fields.category)) ||
    !currencies.has(String(fields.currency)) ||
    typeof fields.remote !== "boolean" ||
    typeof fields.listingRulesAccepted !== "boolean" ||
    !optionalEnum(fields.contactPreference, contactPreferences) ||
    !optionalEnum(fields.propertyListingType, propertyListingTypes) ||
    !optionalEnum(fields.propertyType, propertyTypes)
  ) {
    return null;
  }
  return {
    budgetMax,
    budgetMin,
    category: fields.category as OpportunityComposerDraftFields["category"],
    contactPreference:
      fields.contactPreference as OpportunityComposerDraftFields["contactPreference"],
    currency: fields.currency as OpportunityComposerDraftFields["currency"],
    description,
    listingRulesAccepted: fields.listingRulesAccepted,
    location,
    propertyListingType:
      fields.propertyListingType as OpportunityComposerDraftFields["propertyListingType"],
    propertyType:
      fields.propertyType as OpportunityComposerDraftFields["propertyType"],
    remote: fields.remote,
    skills,
    summary,
    title,
  };
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function optionalEnum(value: unknown, values: Set<string>) {
  return value === "" || (typeof value === "string" && values.has(value));
}

function getLocalStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function removeDraft(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage cleanup is best-effort in private or restricted browser modes.
  }
}
