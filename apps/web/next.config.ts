import type { NextConfig } from "next";

// Set API_URL only for local dev with a separate FastAPI server.
// On Vercel, Python serverless functions in /api handle requests directly.
const apiUrl = process.env.API_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
