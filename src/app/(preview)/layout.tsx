import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Server-side gate for preview routes.
 *
 * Preview routes are disabled by default and only available when
 * PERX_ENABLE_PREVIEW=true is set in the environment.
 *
 * In production, preview routes always return 404 unless explicitly enabled.
 */
export default function PreviewGateLayout({ children }: { children: ReactNode }) {
  const previewEnabled = process.env.PERX_ENABLE_PREVIEW === "true";

  if (!previewEnabled) {
    notFound();
  }

  return <>{children}</>;
}
