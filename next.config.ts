import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/@xenova/transformers/**', './node_modules/onnxruntime-node/**'],
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
