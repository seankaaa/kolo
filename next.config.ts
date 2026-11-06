import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Off on purpose: with cacheComponents, Next keeps visited routes alive in a hidden
  // <Activity> and re-runs effects on the same DOM, which breaks Leaflet's map on back/forward.
  cacheComponents: false,
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
