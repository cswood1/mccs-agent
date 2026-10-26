import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Installation content is read from disk at request time; ship it with the API routes.
  outputFileTracingIncludes: {
    "/api/*": ["./data/content/**/*", "./data/sample/**/*"],
    "/api/**/*": ["./data/content/**/*", "./data/sample/**/*"],
  },
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
