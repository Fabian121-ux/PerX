import { describe, expect, it } from "vitest";

import { formatMoney, MAX_MONEY_MINOR, parseMoneyToMinor } from "@/lib/money";

describe("money helpers", () => {
  it("parses decimal amounts to integer minor units", () => {
    expect(parseMoneyToMinor("123.45").amountMinor).toBe(12345n);
    expect(parseMoneyToMinor("123").amountMinor).toBe(12300n);
    expect(parseMoneyToMinor("0").amountMinor).toBe(0n);
    expect(parseMoneyToMinor("001.2").amountMinor).toBe(120n);
  });

  it("formats integer minor units", () => {
    expect(formatMoney(12345n, "NGN")).toBe("₦123.45");
    expect(formatMoney(MAX_MONEY_MINOR, "NGN")).toBe(
      "₦92,233,720,368,547,758.07",
    );
  });

  it("rejects unsafe amount input", () => {
    expect(() => parseMoneyToMinor("10.999")).toThrow();
    expect(() => parseMoneyToMinor("1,000")).toThrow();
    expect(() => parseMoneyToMinor("1e3")).toThrow();
    expect(() => parseMoneyToMinor("-1")).toThrow();
    expect(() => parseMoneyToMinor("1.")).toThrow();
  });

  it("enforces the signed 64-bit database limit", () => {
    expect(parseMoneyToMinor("92233720368547758.07").amountMinor).toBe(
      MAX_MONEY_MINOR,
    );
    expect(() => parseMoneyToMinor("92233720368547758.08")).toThrow(
      "supported limit",
    );
  });
});
