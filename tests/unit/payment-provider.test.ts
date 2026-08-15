import { describe, expect, it } from "vitest";

import { PaymentProviderUnavailableError } from "@/lib/payments/provider";
import {
  getPaymentProvider,
  getPaymentReadiness,
} from "@/lib/payments/service";

describe("payment provider readiness", () => {
  it("reports payment as unavailable without custody claims", () => {
    const readiness = getPaymentReadiness();

    expect(readiness.available).toBe(false);
    expect(readiness.providerId).toBe("disabled");
    expect(readiness.message).toBe(
      "Payments are currently unavailable. This Deal records agreed terms but does not hold funds.",
    );
  });

  it("cannot create checkout or accept an unverified webhook", async () => {
    const provider = getPaymentProvider();

    await expect(
      provider.createCheckout({
        amountMinor: 10000n,
        currency: "NGN",
        dealId: "deal-1",
        idempotencyKey: "checkout:deal-1",
        payerEmail: "payer@example.test",
        returnUrl: "https://perx.test/app/deals/deal-1",
      }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
    await expect(
      provider.verifyWebhook({ headers: {}, rawBody: new Uint8Array() }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
  });
});
