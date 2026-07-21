/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Prevent webpack from trying to bundle Node.js-only OTel/gRPC packages.
  // ensureTracingStarted() in lib/observability.ts dynamically imports these
  // server-side only; keeping them external loads them at runtime via require().
  serverExternalPackages: [
    "@opentelemetry/sdk-trace-node",
    "@langfuse/otel",
    "@grpc/grpc-js",
  ],
};
export default nextConfig;
