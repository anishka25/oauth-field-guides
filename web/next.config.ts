import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["modal"],
  // fs-read at runtime: curated guides + sandbox sources baked into the Modal image
  outputFileTracingIncludes: { "/**": ["./data/guides/**", "./sandbox/**"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
