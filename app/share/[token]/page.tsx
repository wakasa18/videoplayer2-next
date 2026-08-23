import { AlertTriangle, Link2, ShieldX } from "lucide-react";
import { headers } from "next/headers";

import { PublicShareBrowser } from "@/components/public-share-browser";
import { getShareArchiveLimits } from "@/lib/shares/archive-limits";
import { getPublicShare, registerPublicShareOpen } from "@/lib/shares/data";
import { ShareRequestError } from "@/lib/shares/server";
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
    <main className="grid min-h-screen place-items-center bg-[#f1f3f4] p-5">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e1e5ea] bg-white p-7 text-center shadow-lg sm:p-10">
        <span className={`mx-auto grid size-16 place-items-center rounded-2xl ${gone ? "bg-[#fce8e6] text-[#c5221f]" : "bg-[#fef7e0] text-[#b06000]"}`}>
          {gone ? <ShieldX className="size-8" /> : <AlertTriangle className="size-8" />}
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-.02em] text-[#202124]">
          {gone ? "This shared link is no longer available" : "Shared link unavailable"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">{message}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f1f3f4] px-4 py-2 text-xs font-semibold text-[#5f6368]"><Link2 className="size-4" /> Damon&apos;s Archive secure sharing</div>
      </section>
    </main>
  );
}
