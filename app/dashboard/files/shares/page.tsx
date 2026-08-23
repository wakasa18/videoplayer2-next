import { ArrowLeft, Link2, ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { ShareManager } from "@/components/share-manager";
import { listOwnerShares } from "@/lib/shares/data";

export const metadata = { title: "Shared Links" };
export const dynamic = "force-dynamic";

export default async function SharedLinksPage() {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";
  const shares = await listOwnerShares(origin);
  const active = shares.filter((share) => share.state === "active").length;
  const totalViews = shares.reduce((sum, share) => sum + share.view_count, 0);
  const totalDownloads = shares.reduce((sum, share) => sum + share.download_count, 0);

  return (
    <main className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-sm sm:p-8">
        <Link href="/dashboard/files" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10"><ArrowLeft className="size-4" /> Back to files</Link>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300"><ShieldCheck className="size-4" /> Secure public sharing</div>
            <h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">Shared links</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Copy links again, inspect activity, revoke access, or permanently delete links without exposing private Storage paths.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Summary label="Active" value={active} />
            <Summary label="Views" value={totalViews} />
            <Summary label="Downloads" value={totalDownloads} />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 rounded-[18px] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-300"><Link2 className="size-5 shrink-0" /><p>Create a new link from the three-dot menu on any file or folder.</p></div>
      <ShareManager shares={shares} />
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="min-w-20 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3"><span className="block text-xs font-medium text-slate-400">{label}</span><strong className="mt-1 block truncate text-lg font-semibold text-slate-100">{value.toLocaleString()}</strong></div>;
}
