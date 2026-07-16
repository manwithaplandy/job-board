/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Prevent webpack from trying to bundle Node.js-only OTel/gRPC packages.
  // instrumentation.node.ts runs server-side only; these are loaded at runtime via require().
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@langfuse/otel",
    "@grpc/grpc-js",
  ],
};
export default nextConfig;
