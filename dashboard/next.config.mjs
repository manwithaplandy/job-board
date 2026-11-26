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

// The pages that host variant 3 sandbox frames (plan Task 2.7, spec 10 mitigation (c)) get
// a later, route-scoped header entry that restates the full CSP with frame-src 'none'.
// Next sends the last matching value of a header key, so on these paths this entry
// replaces the baseline CSP. A srcdoc frame loads no URL; frame-src 'none' is there to
// stop the frame from navigating itself anywhere. Task 3.6 adds "/" when the agent page
// moves there. The render smoke's replay page (Task 2.11) mounts frames too.
//
// If the real-browser suite (tests/sandbox/sandbox.spec.ts, "the srcdoc frame still loads
// and runs with the parent's frame-src 'none'") shows that frame-src 'none' blocks the
// srcdoc load itself in any browser, the plan says to drop this entry and rely on the
// second-load and liveness teardown plus the static checks: set
// SANDBOX_HOST_FRAME_SRC_NONE to false. lib/securityHeaders.test.ts covers both versions.
const SANDBOX_HOST_FRAME_SRC_NONE = true;
export const SANDBOX_HOST_PATHS = ["/agent/:path*", "/ui-gallery/sandbox-harness", "/ui-gallery/surface-replay"];
const sandboxHostCsp = `${contentSecurityPolicy}; frame-src 'none'`;

/** The header rules, with or without the sandbox host entry (exported for the test). */
export function headerRules(sandboxHostFrameSrcNone) {
  const rules = [{ source: "/:path*", headers: securityHeaders }];
  if (sandboxHostFrameSrcNone) {
    for (const source of SANDBOX_HOST_PATHS) {
      rules.push({ source, headers: [{ key: "Content-Security-Policy", value: sandboxHostCsp }] });
    }
  }
  return rules;
}

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
  // @ai-sdk/otel (lib/agent/telemetry.ts) is external too, so it resolves the same
  // @opentelemetry/api copy as the tracer provider it records into.
  serverExternalPackages: [
    "@opentelemetry/sdk-trace-node",
    "@langfuse/otel",
    "@ai-sdk/otel",
    "@grpc/grpc-js",
  ],
  // The render smoke's replay page (Task 2.11) reads recordings and surface fixtures from
  // disk by name. Next's file tracing would copy every one of them into the server output
  // for that route; none is needed in production, where the page reads no file unless
  // SURFACE_REPLAY=1 (fix round 1, M4). lib/agent/evals/replay.test.ts checks the globs.
  outputFileTracingExcludes: {
    "/ui-gallery/surface-replay": ["./lib/agent/evals/recordings/**", "./lib/agent/evals/fixtures/**"],
  },
  async headers() {
    return headerRules(SANDBOX_HOST_FRAME_SRC_NONE);
  },
};
export default nextConfig;
