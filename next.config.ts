import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    cacheComponents: true,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
