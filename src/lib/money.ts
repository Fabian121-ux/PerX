export type Money = {
  amountMinor: bigint;
  currency: string;
};

export function parseMoneyToMinor(input: string, currency = "NGN"): Money {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }

  const [major, minor = ""] = trimmed.split(".");
  const normalizedMinor = (minor + "00").slice(0, 2);

  return {
    amountMinor: BigInt(major) * 100n + BigInt(normalizedMinor),
    currency,
  };
}

export function formatMoney(amountMinor: bigint | number | string | null | undefined, currency = "NGN") {
  if (amountMinor === null || amountMinor === undefined) return "Budget flexible";

  const value = typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
  const major = value / 100n;
  const minor = value % 100n;

  return new Intl.NumberFormat("en-NG", {
    currency,
    maximumFractionDigits: minor === 0n ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(Number(major) + Number(minor) / 100);
}

export function formatBudgetRange(
  minMinor: bigint | number | string | null | undefined,
  maxMinor: bigint | number | string | null | undefined,
  currency = "NGN",
) {
  if (!minMinor && !maxMinor) return "Budget flexible";
  if (minMinor && maxMinor) return `${formatMoney(minMinor, currency)} – ${formatMoney(maxMinor, currency)}`;
  if (minMinor) return `From ${formatMoney(minMinor, currency)}`;
  return `Up to ${formatMoney(maxMinor, currency)}`;
}
