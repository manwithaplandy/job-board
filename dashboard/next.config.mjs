// Baseline security headers for every response. The CSP deliberately leaves
// script-src unset: Next's inline bootstrap and the theme script would need nonces
// (which force every page dynamic). These directives carry no such cost and still
// block framing, plugin content, <base> hijacking and off-site form posts.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // next dev 16.4+ otherwise writes a managed AGENTS.md into the project; the
  // repo keeps its own agent guidance in CLAUDE.md.
  agentRules: false,
  poweredByHeader: false,
  // Prevent webpack from trying to bundle Node.js-only OTel/gRPC packages.
  // ensureTracingStarted() in lib/observability.ts dynamically imports these
  // server-side only; keeping them external loads them at runtime via require().
  serverExternalPackages: [
    "@opentelemetry/sdk-trace-node",
    "@langfuse/otel",
    "@grpc/grpc-js",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
