import { AlertTriangle, Link2, ShieldX } from "lucide-react";
import { cookies, headers } from "next/headers";

import { PublicShareBrowser } from "@/components/public-share-browser";
import { PublicShareUnlock } from "@/components/public-share-unlock";
import { getShareArchiveLimits } from "@/lib/shares/archive-limits";
import { getPublicShare, registerPublicShareOpen } from "@/lib/shares/data";
import {
  getPublicSharePasswordGateFromCookie,
  shareAccessCookieName,
  ShareRequestError,
} from "@/lib/shares/server";
import type { PublicShareResult } from "@/lib/shares/types";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ path?: string | string[] }>;
};

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Secure shared link",
  robots: { index: false, follow: false },
};

export default async function PublicSharePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const rawPath = (await searchParams).path;
  const path = Array.isArray(rawPath) ? rawPath[0] ?? "" : rawPath ?? "";
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const publicUrl = `${proto}://${host}/share/${encodeURIComponent(token)}${path ? `?path=${encodeURIComponent(path)}` : ""}`;

  let result: PublicShareResult | null = null;
  let failure: unknown = null;
  let passwordGate: Awaited<ReturnType<typeof getPublicSharePasswordGateFromCookie>> | null = null;

  try {
    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(shareAccessCookieName(token))?.value ?? null;
    passwordGate = await getPublicSharePasswordGateFromCookie(token, accessCookie);
  } catch (error) {
    failure = error;
  }

  if (passwordGate?.required && !passwordGate.unlocked) {
    return <PublicShareUnlock token={token} hint={passwordGate.hint} />;
  }

  if (!failure) {
    try {
      result = await getPublicShare(token, path);
      const requestHeaders = new Headers();
      for (const name of ["x-forwarded-for", "x-real-ip", "user-agent"]) {
        const value = headerList.get(name);
        if (value) requestHeaders.set(name, value);
      }
      await registerPublicShareOpen(
        token,
        new Request(publicUrl, { headers: requestHeaders }),
      );
    } catch (error) {
      failure = error;
    }
  }

  if (result) {
    const limits = getShareArchiveLimits();
    return (
      <PublicShareBrowser
        token={token}
        result={result}
        publicUrl={publicUrl}
        archiveLimits={{ maxFiles: limits.maxFiles, maxBytes: limits.maxBytes }}
        supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null}
      />
    );
  }

  const message = failure instanceof Error ? failure.message : "This shared link is unavailable.";
  const gone = failure instanceof ShareRequestError && failure.status === 410;
  return (
    <main className="grid min-h-screen place-items-center bg-[#030814] p-5 text-slate-100">
      <section className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-cyan-200/10 bg-[#081321] p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,.45)] sm:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(47,215,255,.65),transparent)]" />
        <span className={`mx-auto grid size-16 place-items-center rounded-2xl ${gone ? "bg-red-400/10 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>
          {gone ? <ShieldX className="size-8" /> : <AlertTriangle className="size-8" />}
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-.02em] text-slate-100">
          {gone ? "This shared link is no longer available" : "Shared link unavailable"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/10 bg-[#06101d] px-4 py-2 text-xs font-semibold text-slate-400"><Link2 className="size-4 text-cyan-300" /> Damon&apos;s Archive secure sharing</div>
      </section>
    </main>
  );
}
