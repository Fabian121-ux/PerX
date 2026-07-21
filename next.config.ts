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
};

export default nextConfig;
