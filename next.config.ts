import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A minimal Docker image: the server and its real dependencies, nothing else.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
