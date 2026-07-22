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
    remotePatterns: [
      {
        hostname: "images.unsplash.com",
        protocol: "https",
      },
    ],
  },
  deploymentId: process.env.VERCEL_GIT_COMMIT_SHA,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/app/dashboard", permanent: true },
      { source: "/deals/:path*", destination: "/app/deals/:path*", permanent: true },
      { source: "/escrow", destination: "/app/escrow", permanent: true },
      { source: "/logistics", destination: "/app/logistics", permanent: true },
      { source: "/market", destination: "/app/market", permanent: true },
      { source: "/messages/:path*", destination: "/app/messages/:path*", permanent: true },
      { source: "/network", destination: "/app/network", permanent: true },
      { source: "/notifications", destination: "/app/notifications", permanent: true },
      { source: "/opportunities/:path*", destination: "/app/opportunities/:path*", permanent: true },
      { source: "/profile/:path*", destination: "/app/profile/:path*", permanent: true },
      { source: "/proposals/:path*", destination: "/app/proposals/:path*", permanent: true },
      { source: "/real-estate", destination: "/app/real-estate", permanent: true },
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
