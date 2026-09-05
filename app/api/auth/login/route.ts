import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  APP_SESSION_COOKIE,
  checkLoginLock,
  findOwnerByEmailHash,
  normalizeLoginEmail,
  recordLoginFailure,
  recordLoginSuccess,
  requestIp,
  requireSecurityAdmin,
  securityHash,
} from "@/lib/security/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = normalizeLoginEmail(body.email);
    const password = String(body.password ?? "");
    if (!email || !email.includes("@") || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const admin = requireSecurityAdmin();
    const emailHash = securityHash(email);
    const ipHash = securityHash(requestIp(request));
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const lock = await checkLoginLock(admin, emailHash, ipHash);
    if (lock.locked) {
      const ownerId = await findOwnerByEmailHash(admin, emailHash);
      await admin.from("workspace_login_history").insert({
        owner_id: ownerId,
        email_hash: emailHash,
        ip_hash: ipHash,
        status: "locked",
        reason: "Attempt blocked by temporary lockout",
        user_agent: userAgent.slice(0, 1000),
        device_label: null,
      });
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${Math.ceil(lock.retryAfterSeconds / 60)} minute(s).`, retryAfterSeconds: lock.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(lock.retryAfterSeconds) } },
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      },
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      const ownerId = await findOwnerByEmailHash(admin, emailHash);
      const failed = await recordLoginFailure(admin, {
        bucketKey: lock.bucketKey,
        emailHash,
        ipHash,
        ownerId,
        userAgent,
        reason: error?.message || "Invalid credentials",
      });
      if (failed.locked) {
        return NextResponse.json(
          { error: "Too many failed attempts. Sign-in is locked for 10 minutes.", retryAfterSeconds: failed.retryAfterSeconds },
          { status: 429, headers: { "Retry-After": String(failed.retryAfterSeconds) } },
        );
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const sessionId = await recordLoginSuccess(admin, request, data.user, lock.bucketKey, emailHash, ipHash);
    cookieStore.set(APP_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign-in failed." },
      { status: 500 },
    );
  }
}
