import type { NextConfig } from "next";

if (
  process.env.NODE_ENV === "production" &&
  process.env.PERX_DATA_MODE === "mock"
) {
  throw new Error("PERX_DATA_MODE=mock is strictly prohibited in production.");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    /*
      Uploads are stored as full-resolution originals (up to UPLOAD_MAX_BYTES,
      5 MB by default) in Supabase Storage - there is no server-side resizing.
      Without the Supabase host listed here, `next/image` refuses to optimize
      those URLs, so a 44px avatar and a 640px feed card were both downloading
      the untouched original. Listing the host routes them through the built-in
      optimizer, which resizes and re-encodes per request.
    */
    remotePatterns: [
      { hostname: "images.unsplash.com", protocol: "https" },
      { hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**", protocol: "https" },
      { hostname: "*.supabase.in", pathname: "/storage/v1/object/public/**", protocol: "https" },
    ],
    // AVIF first, WebP second: both are far smaller than the stored JPEG/PNG,
    // and the browser picks whichever it supports.
    formats: ["image/avif", "image/webp"],
    /*
      The feed column is capped at 640px and avatars render at 44px, so the
      default ladder (which starts at 640 and runs to 3840) generated many
      variants the UI can never use. These match the sizes actually rendered.
    */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Optimized derivatives are content-addressed by URL, so a long TTL is
    // safe: a changed image gets a new storage key and therefore a new URL.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  deploymentId: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 32) : undefined,
  async redirects() {
    return [
      // The separate Dashboard route was retired: personal activity now lives
      // inside Profile rather than competing with it as a second primary
      // destination. Legacy dashboard links land on the user's own hub.
      { source: "/dashboard", destination: "/app/profile", permanent: false },
      { source: "/app/dashboard", destination: "/app/profile", permanent: false },
      { source: "/deals/:path*", destination: "/app/deals/:path*", permanent: true },
      { source: "/escrow", destination: "/app/escrow", permanent: true },
      { source: "/logistics", destination: "/app/logistics", permanent: true },
      { source: "/market", destination: "/app/market", permanent: true },
      { source: "/messages/:path*", destination: "/app/messages/:path*", permanent: true },
      { source: "/network", destination: "/app/network", permanent: true },
      { source: "/notifications", destination: "/app/notifications", permanent: true },
      { source: "/opportunities", destination: "/app/opportunities", permanent: true },
      { source: "/opportunities/new", destination: "/app/opportunities/new", permanent: true },
      { source: "/opportunities/:opportunityId/edit", destination: "/app/opportunities/:opportunityId/edit", permanent: true },
      { source: "/profile/:path*", destination: "/app/profile/:path*", permanent: true },
      { source: "/proposals/:path*", destination: "/app/proposals/:path*", permanent: true },
      // The Real Estate vertical was retired. Legacy `/real-estate` and
      // `/app/real-estate` links are folded back into general discovery
      // rather than 404ing, so old bookmarks and shared links still land
      // somewhere useful. Not `permanent`: the redirect target is a product
      // decision that may change, and a 308 would be cached indefinitely.
      { source: "/real-estate", destination: "/app/discover", permanent: false },
      { source: "/app/real-estate", destination: "/app/discover", permanent: false },
      { source: "/preview/real-estate", destination: "/preview", permanent: false },
      { source: "/reports", destination: "/app/reports", permanent: true },
      { source: "/reviews", destination: "/app/reviews", permanent: true },
      { source: "/roles", destination: "/app/roles", permanent: true },
      { source: "/saved", destination: "/app/saved", permanent: true },
      { source: "/service-center", destination: "/app/service-center", permanent: true },
      { source: "/services", destination: "/app/services", permanent: true },
      { source: "/settings/:path*", destination: "/app/settings/:path*", permanent: true },
      { source: "/travel-stay", destination: "/app/travel-stay", permanent: true },
      { source: "/wallet", destination: "/app/wallet", permanent: true },
    ];
  },
};

export default nextConfig;
