import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force dynamic rendering for all pages (no static generation)
  // Required because wallet SDKs use browser-only APIs
  experimental: {},
  // Webpack configuration to handle missing Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
