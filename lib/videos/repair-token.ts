import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { VideoRequestError } from "@/lib/videos/server";

export type VideoRepairClaims = {
  version: 1;
  videoId: number;
  ownerId: string;
  objectPath: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number | null;
  expiresAt: number;
};

export function createVideoRepairToken(
  claims: Omit<VideoRepairClaims, "version" | "expiresAt">,
): string {
  const payload: VideoRepairClaims = {
    version: 1,
    ...claims,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyVideoRepairToken(token: string): VideoRepairClaims {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) {
    throw new VideoRequestError("The restore token is invalid.", 400);
  }

  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new VideoRequestError("The restore token is invalid.", 400);
  }

  let payload: VideoRepairClaims;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VideoRepairClaims;
  } catch {
    throw new VideoRequestError("The restore token is invalid.", 400);
  }

  if (
    payload.version !== 1 ||
    !Number.isInteger(payload.videoId) ||
    payload.videoId < 1 ||
    !payload.ownerId ||
    !payload.objectPath ||
    !payload.storedFilename ||
    !payload.originalFilename ||
    !payload.mimeType ||
    !Number.isSafeInteger(payload.fileSize) ||
    payload.fileSize < 1 ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt < Date.now()
  ) {
    throw new VideoRequestError("The restore token expired or is invalid.", 400);
  }

  return payload;
}

function sign(value: string): string {
  const secret =
    process.env.VIDEO_REPAIR_TOKEN_SECRET?.trim() ||
    process.env.SHARE_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!secret) {
    throw new VideoRequestError(
      "Video restore requires VIDEO_REPAIR_TOKEN_SECRET or a server-only Supabase secret.",
      500,
    );
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}
