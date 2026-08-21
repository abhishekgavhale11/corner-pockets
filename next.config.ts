import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent Desktop/package-lock.json confuses Next's workspace root inference.
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(Array.isArray(config.ignoreWarnings) ? config.ignoreWarnings : []),
      { module: /node_modules[\\/]jose[\\/]/ },
    ];
    return config;
  },
};

export default nextConfig;
