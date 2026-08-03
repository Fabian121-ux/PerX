import {
  PaymentProviderUnavailableError,
  type PaymentProvider,
} from "@/lib/payments/provider";

export class DisabledPaymentProvider implements PaymentProvider {
  getAvailability() {
    return {
      available: false,
      message:
        "Online payment is being prepared and is not active. PerX does not collect or hold funds.",
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
