import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'" },
];

// File previews are intentionally rendered inside an iframe belonging to this
// same application. Keep third-party framing blocked while allowing only the
// app's own preview dialogs to embed these two endpoints.
const sameOriginPreviewHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: "base-uri 'none'; frame-ancestors 'self'; object-src 'none'; form-action 'none'",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Later matching rules override the global DENY values above.
      { source: "/api/files/:id/preview", headers: sameOriginPreviewHeaders },
      {
        source: "/api/public-shares/:token/files/:fileId/preview",
        headers: sameOriginPreviewHeaders,
      },
    ];
  },
};

export default nextConfig;
