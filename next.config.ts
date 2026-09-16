import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de Docker mínima: sólo el servidor y sus dependencias reales.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
