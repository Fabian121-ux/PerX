export type Money = {
  amountMinor: bigint;
  currency: string;
};

export const MAX_MONEY_MINOR = 9_223_372_036_854_775_807n;

export function parseMoneyToMinor(input: string, currency = "NGN"): Money {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }

  const [major, minor = ""] = trimmed.split(".");
  const normalizedMinor = (minor + "00").slice(0, 2);

  const amountMinor = BigInt(major) * 100n + BigInt(normalizedMinor);
  if (amountMinor > MAX_MONEY_MINOR) {
    throw new Error("Amount exceeds the supported limit.");
  }

  return {
    amountMinor,
    currency,
  };
}

export function formatMoney(
  amountMinor: bigint | number | string | null | undefined,
  currency = "NGN",
) {
  if (amountMinor === null || amountMinor === undefined)
    return "Budget flexible";

  const value =
    typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
  const absolute = value < 0n ? -value : value;
  const major = absolute / 100n;
  const minor = absolute % 100n;
  const integer = new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(major);
  const currencySymbol =
    new Intl.NumberFormat("en-NG", {
      currency,
      style: "currency",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  const fraction = minor === 0n ? "" : `.${minor.toString().padStart(2, "0")}`;
  return `${value < 0n ? "-" : ""}${currencySymbol}${integer}${fraction}`;
}

export function formatBudgetRange(
  minMinor: bigint | number | string | null | undefined,
  maxMinor: bigint | number | string | null | undefined,
  currency = "NGN",
) {
  if (!minMinor && !maxMinor) return "Budget flexible";
  if (minMinor && maxMinor)
    return `${formatMoney(minMinor, currency)} – ${formatMoney(maxMinor, currency)}`;
  if (minMinor) return `From ${formatMoney(minMinor, currency)}`;
  return `Up to ${formatMoney(maxMinor, currency)}`;
}
