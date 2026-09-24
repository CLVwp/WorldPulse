import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export statique pour Cloudflare Workers assets (dossier out/)
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root: path.join(__dirname),
  },
  // Dev uniquement : proxifie /api/* vers le Worker local (bun run dev:api).
  // Ignoré avec output: "export" — en prod, l'API est servie sur la même origine.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env["API_PROXY_TARGET"] ?? "http://localhost:8787"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
