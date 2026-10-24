import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: [
    "192.168.1.30",
    "192.168.1.*",
    "localhost",
    "127.0.0.1",
  ],
  async rewrites() {
    const backendHost =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://trackmysubs-backend.onrender.com"
        : "http://127.0.0.1:5000");
    return [
      {
        source: "/api/((?!family).*)",
        destination: `${backendHost}/api/:1`,
      },
    ];
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
