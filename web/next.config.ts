import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

initOpenNextCloudflareForDev({
  persist: { path: path.resolve(__dirname, "../.wrangler/state/v3") },
});
