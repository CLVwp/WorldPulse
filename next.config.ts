import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export statique pour Cloudflare Workers assets (dossier out/)
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
