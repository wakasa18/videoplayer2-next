import { NextResponse } from "next/server";

import {
  buildPublicShareUrl,
  createSharePasswordHash,
  decryptShareToken,
  requireShareOwnerContext,
  sanitizeDisplayName,
  sanitizeExpiry,
  sanitizeMaxDownloads,
  sanitizePasswordHint,
  sanitizeSharePassword,
  sanitizeShareMessage,
  sanitizeShareTitle,
  shareErrorResponse,
  ShareRequestError,
} from "@/lib/shares/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpdatePayload = {
  action?: unknown;
  expiresAt?: unknown;
  maxDownloads?: unknown;
  allowDownloads?: unknown;
  shareTitle?: unknown;
  shareMessage?: unknown;
  displayName?: unknown;
  password?: unknown;
  passwordHint?: unknown;
  clearPassword?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireShareOwnerContext(request);
    const payload = (await request.json()) as UpdatePayload;
    const action = String(payload.action ?? "update");

    const { data: existing, error: findError } = await client
      .from("important_file_shares")
      .select("id,token_ciphertext,revoked_at,password_hash,password_salt,password_hint")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (findError) throw new ShareRequestError(findError.message, 422);
    if (!existing) throw new ShareRequestError("Shared link not found.", 404);

    if (action === "revoke") {
      const { error } = await client
        .from("important_file_shares")
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new ShareRequestError(error.message, 422);
      return NextResponse.json({ success: true, state: "revoked" });
    }

    if (action === "activate") {
      const { error } = await client
        .from("important_file_shares")
        .update({ revoked_at: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new ShareRequestError(error.message, 422);
      return NextResponse.json({ success: true, state: "active" });
    }

    const password = sanitizeSharePassword(payload.password);
    const clearPassword = payload.clearPassword === true;
    const passwordData = password ? createSharePasswordHash(password) : null;
    const update = {
      expires_at: sanitizeExpiry(payload.expiresAt),
      max_downloads: sanitizeMaxDownloads(payload.maxDownloads),
      allow_downloads: payload.allowDownloads !== false,
      share_title: sanitizeShareTitle(payload.shareTitle),
      share_message: sanitizeShareMessage(payload.shareMessage),
      display_name: sanitizeDisplayName(payload.displayName),
      ...(clearPassword
        ? { password_hash: null, password_salt: null, password_hint: null }
        : passwordData
          ? { password_hash: passwordData.passwordHash, password_salt: passwordData.passwordSalt, password_hint: sanitizePasswordHint(payload.passwordHint) }
          : { password_hint: existing.password_hash ? sanitizePasswordHint(payload.passwordHint) ?? existing.password_hint : null }),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from("important_file_shares")
      .update(update)
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new ShareRequestError(error.message, 422);

    const token = decryptShareToken(existing.token_ciphertext);
    return NextResponse.json({
      success: true,
      publicUrl: token ? buildPublicShareUrl(request, token) : null,
    });
  } catch (error) {
    return shareErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireShareOwnerContext(request);
    const { error } = await client
      .from("important_file_shares")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new ShareRequestError(error.message, 422);
    return NextResponse.json({ success: true });
  } catch (error) {
    return shareErrorResponse(error);
  }
}

function parseId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new ShareRequestError("Invalid shared-link identifier.");
  }
  return id;
}
