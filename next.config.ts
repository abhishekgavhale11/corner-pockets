import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent Desktop/package-lock.json confuses Next's workspace root inference.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
