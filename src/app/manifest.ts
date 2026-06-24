import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#070707",
    categories: ["business", "productivity", "finance"],
    description:
      "An opportunity ecosystem for discovery, trust, structured proposals, deals, simulated escrow, and reputation.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icons/icon-192.png",
        type: "image/png",
      },
      {
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
    start_url: "/",
    theme_color: "#070707",
  };
}
