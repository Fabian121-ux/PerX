import { describe, expect, it } from "vitest";

import { formatMoney, parseMoneyToMinor } from "@/lib/money";

describe("money helpers", () => {
  it("parses decimal amounts to integer minor units", () => {
    expect(parseMoneyToMinor("123.45").amountMinor).toBe(12345n);
    expect(parseMoneyToMinor("123").amountMinor).toBe(12300n);
  });

  it("formats integer minor units", () => {
    expect(formatMoney(12345n, "NGN")).toBe("₦123.45");
  });

  it("rejects unsafe amount input", () => {
    expect(() => parseMoneyToMinor("10.999")).toThrow();
  });
});
