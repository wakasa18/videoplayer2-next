import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Cache Components disabled during the authenticated migration.
  // Supabase Auth reads request cookies, so dashboard routes must render
  // per request until their dynamic sections are moved behind Suspense.
  cacheComponents: false,
};

export default nextConfig;
