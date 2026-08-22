import "server-only";

import type { EnvironmentDiagnostic } from "@/lib/system/types";

const ENVIRONMENT_RULES: Array<{
  key: string;
  required: boolean;
  serverOnly: boolean;
  note: string;
}> = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    serverOnly: false,
    note: "Supabase project URL used by browser and server clients.",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    required: true,
    serverOnly: false,
    note: "Publishable browser key. Database tables still require RLS.",
  },
  {
    key: "SUPABASE_SECRET_KEY",
    required: false,
    serverOnly: true,
    note: "Preferred modern server secret. The legacy service-role key is also supported.",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: false,
    serverOnly: true,
    note: "Legacy server-only fallback for trusted Storage and maintenance actions.",
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: true,
    serverOnly: false,
    note: "Canonical production URL used when generating share links.",
  },
  {
    key: "CRON_SECRET",
    required: true,
    serverOnly: true,
    note: "Authenticates Vercel assignment-automation cron requests.",
  },
  {
    key: "SHARE_TOKEN_ENCRYPTION_KEY",
    required: true,
    serverOnly: true,
    note: "Encrypts and signs public share tokens.",
  },
  {
    key: "SHARE_ANALYTICS_SALT",
    required: true,
    serverOnly: true,
    note: "Pseudonymizes share analytics identifiers.",
  },
  {
    key: "VIDEO_REPAIR_TOKEN_SECRET",
    required: false,
    serverOnly: true,
    note: "Optional dedicated secret for reconnecting missing video objects.",
  },
  {
    key: "HEALTH_CHECK_SECRET",
    required: true,
    serverOnly: true,
    note: "Bearer secret required for the deep production health check.",
  },
  {
    key: "SUPABASE_FILES_BUCKET",
    required: false,
    serverOnly: true,
    note: "Defaults to important-files when omitted.",
  },
  {
    key: "SUPABASE_VIDEOS_BUCKET",
    required: false,
    serverOnly: true,
    note: "Defaults to videos when omitted.",
  },
];

export function getEnvironmentDiagnostics(): EnvironmentDiagnostic[] {
  return ENVIRONMENT_RULES.map((rule) => ({
    ...rule,
    configured: isConfigured(process.env[rule.key]),
  }));
}

export function hasServerAdminSecret(): boolean {
  return Boolean(
    clean(process.env.SUPABASE_SECRET_KEY) ||
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
      clean(process.env.SUPABASE_SERVICE_KEY),
  );
}

export function getCanonicalAppUrl(): string | null {
  const explicit = clean(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) || clean(process.env.VERCEL_URL);
  return vercel ? `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : null;
}

function isConfigured(value: string | undefined): boolean {
  const normalized = clean(value);
  if (!normalized) return false;
  return !/(replace|your-|example|changeme|placeholder|xxxxx)/i.test(normalized);
}

function clean(value: string | undefined): string {
  return String(value ?? "").trim();
}
