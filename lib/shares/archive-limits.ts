import "server-only";

export type ShareArchiveLimits = {
  maxFiles: number;
  maxBytes: number;
  rateLimit: number;
};

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function getShareArchiveLimits(): ShareArchiveLimits {
  return {
    maxFiles: positiveInteger("SHARE_ARCHIVE_MAX_FILES", 25, 100),
    maxBytes: positiveInteger("SHARE_ARCHIVE_MAX_BYTES", 64 * 1024 * 1024, 250 * 1024 * 1024),
    rateLimit: positiveInteger("SHARE_ARCHIVE_RATE_LIMIT", 5, 100),
  };
}
