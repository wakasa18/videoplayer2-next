import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

const DEFAULT_AFTER_CONFIRM = "/dashboard";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeInternalPath(searchParams.get("next"));

  if (!tokenHash || !type) {
    redirect("/auth/error?code=missing_token");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    redirect("/auth/error?code=verification_failed");
  }

  redirect(nextPath);
}

function safeInternalPath(value: string | null): string {
  const candidate = String(value ?? "").trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_AFTER_CONFIRM;
  }

  try {
    const base = new URL("https://internal.invalid");
    const resolved = new URL(candidate, base);
    if (resolved.origin !== base.origin) return DEFAULT_AFTER_CONFIRM;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_AFTER_CONFIRM;
  }
}
