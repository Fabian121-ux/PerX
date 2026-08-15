import {
  PaymentProviderUnavailableError,
  type PaymentProvider,
} from "@/lib/payments/provider";

export class DisabledPaymentProvider implements PaymentProvider {
  getAvailability() {
    return {
      available: false,
      message:
        "Payments are currently unavailable. This Deal records agreed terms but does not hold funds.",
      providerId: "disabled",
    } as const;
  }

  async createCheckout(): Promise<never> {
    throw new PaymentProviderUnavailableError();
  }

  async verifyWebhook(): Promise<never> {
    throw new PaymentProviderUnavailableError(
      "Payment webhooks are unavailable because no provider is active.",
    );
  }
}
