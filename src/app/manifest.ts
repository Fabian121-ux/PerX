import type { MetadataRoute } from "next";

import { PWA_START_URL } from "@/lib/navigation/entry";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f4f7fb",
    categories: ["business", "productivity", "finance"],
    description:
      "An opportunity ecosystem for discovery, trust, structured proposals, deals, beta-stage simulated payment states, and reputation.",
    display: "standalone",
    // Stable install identity so changing `start_url` does not orphan
    // already-installed instances.
    id: "/",
    scope: "/",
    icons: [
      {
        purpose: "any",
        sizes: "192x192",
        src: "/icons/icon-192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icons/icon-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "192x192",
        src: "/icons/maskable-icon-192.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/maskable-icon-512.png",
        type: "image/png",
      },
    ],
    name: "perX",
    short_name: "perX",
    // Launches at `/`, which resolves server-side: an authenticated user is
    // redirected to the app home, an unauthenticated user still gets the
    // public landing page. See `src/lib/navigation/entry.ts`.
    start_url: PWA_START_URL,
    theme_color: "#061936",
  };
}
