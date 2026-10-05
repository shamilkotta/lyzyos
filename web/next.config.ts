import type { NextConfig } from "next";

const apiOrigin = process.env.API_DEV_ORIGIN ?? "http://127.0.0.1:8788";
const agentOrigin = process.env.AGENT_DEV_ORIGIN ?? "http://127.0.0.1:8787";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/agents/:path*", destination: `${agentOrigin}/agents/:path*` },
    ];
  },
};

export default nextConfig;
