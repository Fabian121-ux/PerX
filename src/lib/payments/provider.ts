export type PaymentProviderAvailability = {
  available: boolean;
  message: string;
  providerId: string;
};

export type CreatePaymentRequest = {
  amountMinor: bigint;
  currency: string;
  dealId: string;
  idempotencyKey: string;
  payerEmail: string;
  returnUrl: string;
};

export type PaymentCheckout = {
  checkoutUrl: string;
  expiresAt: Date | null;
  providerReference: string;
};

export type VerifiedPaymentEvent = {
  amountMinor: bigint;
  currency: string;
  eventId: string;
  occurredAt: Date;
  providerReference: string;
  status: "CONFIRMED" | "FAILED" | "REVERSED";
};

export type VerifyPaymentWebhookRequest = {
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: Uint8Array;
};

export interface PaymentProvider {
  getAvailability(): PaymentProviderAvailability;
  createCheckout(request: CreatePaymentRequest): Promise<PaymentCheckout>;
  verifyWebhook(
    request: VerifyPaymentWebhookRequest,
  ): Promise<VerifiedPaymentEvent>;
}

export class PaymentProviderUnavailableError extends Error {
  constructor(message = "Online payment is not available.") {
    super(message);
    this.name = "PaymentProviderUnavailableError";
  }
}
