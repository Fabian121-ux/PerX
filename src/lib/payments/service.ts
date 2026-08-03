import { DisabledPaymentProvider } from "@/lib/payments/disabled-provider";
import type { PaymentProvider } from "@/lib/payments/provider";

const disabledProvider = new DisabledPaymentProvider();

export function getPaymentProvider(): PaymentProvider {
  return disabledProvider;
}

export function getPaymentReadiness() {
  return getPaymentProvider().getAvailability();
}
