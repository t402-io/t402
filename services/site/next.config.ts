import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Static export for Cloudflare Pages
  images: {
    formats: ["image/avif", "image/webp"],
    unoptimized: true, // Required for static export
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
};

export default nextConfig;
