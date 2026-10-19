import "server-only";

import { parseVerifiedShipment, type VerifiedShipment } from "@/lib/tracking/shipment-contract";
export type { VerifiedShipment } from "@/lib/tracking/shipment-contract";

const MAX_RESPONSE_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 3_500;

function resolveProvider() {
  const origin = process.env.PTAHX_SHIPMENT_PROVIDER_ORIGIN;
  const token = process.env.PTAHX_SHIPMENT_PROVIDER_TOKEN;
  if (!origin || !token) return null;
  try {
    const url = new URL(origin);
    // Only explicitly configured, secure origins. No user-supplied URLs.
    if (url.protocol !== "https:" ||
      url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      token.length < 16
    ) return null;
    return { origin: url.origin, token };
  } catch {
    return null;
  }
}

export async function getVerifiedShipmentForDeal(dealId: string): Promise<VerifiedShipment | null> {
  const provider = resolveProvider();
  if (!provider || !dealId || dealId.length > 160) return null;

  try {
    const url = new URL(`/v1/shipments/by-deal/${encodeURIComponent(dealId)}`, provider.origin);
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${provider.token}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_BYTES) return null;
    // Body is bounded even if content-length is missing/incorrect.
    const reader = response.body?.getReader();
    if (!reader) return null;
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) return null;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const text = new TextDecoder().decode(
      Uint8Array.from(chunks.flatMap((chunk) => Array.from(chunk))),
    );
    return parseVerifiedShipment(JSON.parse(text) as unknown, dealId);
  } catch {
    // Courier outage must never break the Track page or leak provider details.
    return null;
  }
}
