"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Ban,
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File,
  Folder,
  Link2,
  MoreVertical,
  Power,
  QrCode,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ShareEvent, ShareListItem } from "@/lib/shares/types";

type Analytics = {
  share: ShareListItem;
  events: ShareEvent[];
  eventCounts: Record<string, number>;
};

export function ShareManager({ shares }: { shares: ShareListItem[] }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [qrShare, setQrShare] = useState<ShareListItem | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState("");

  async function copyLink(share: ShareListItem) {
    if (!share.public_url) return;
    await navigator.clipboard.writeText(absoluteUrl(share.public_url));
    setCopiedId(share.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  async function mutate(id: number, action: "revoke" | "activate" | "delete") {
    if (busyId) return;
    if (action === "delete" && !window.confirm("Permanently delete this shared link and its analytics?")) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/shares/${id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: action === "delete" ? undefined : { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update the shared link.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the shared link.");
    } finally {
      setBusyId(null);
    }
  }

  async function loadAnalytics(share: ShareListItem) {
    setAnalyticsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/shares/${share.id}/analytics`);
      const payload = (await response.json()) as Analytics & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not load link analytics.");
      setAnalytics(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load link analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  if (!shares.length) {
    return (
      <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[#c6dafc] bg-white p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
            <Link2 className="size-7" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-[#202124]">No shared links yet</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6368]">
            Open a file or folder menu and choose Share to create the first public link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] p-4 text-sm text-[#a50e0e]">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {shares.map((share, index) => {
          const Icon = share.share_type === "folder" ? Folder : File;
          const state = stateInfo(share.state);
          return (
            <motion.article
              key={share.id}
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: Math.min(index, 14) * 0.035, duration: 0.24 }}
              className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm transition hover:border-[#c6dafc] hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-[#202124]">{share.target_name}</h2>
                      <p className="mt-1 text-xs text-[#80868b]">
                        {share.share_type === "folder" ? "Folder link" : "File link"} · Created {formatDate(share.created_at)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="grid size-9 shrink-0 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]" aria-label="Shared link actions">
                          <MoreVertical className="size-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-2xl border-[#e1e5ea] bg-white p-2 shadow-xl">
                        <DropdownMenuItem disabled={!share.public_url} onSelect={() => void copyLink(share)} className={itemClass}><Copy /> Copy link</DropdownMenuItem>
                        {share.public_url ? <DropdownMenuItem asChild className={itemClass}><a href={share.public_url} target="_blank" rel="noreferrer"><ExternalLink /> Open link</a></DropdownMenuItem> : null}
                        <DropdownMenuItem disabled={!share.public_url} onSelect={() => setQrShare(share)} className={itemClass}><QrCode /> Show QR code</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void loadAnalytics(share)} className={itemClass}><Activity /> View analytics</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#eef1f3]" />
                        {share.state === "revoked" ? (
                          <DropdownMenuItem disabled={busyId === share.id} onSelect={() => void mutate(share.id, "activate")} className={itemClass}><Power /> Reactivate</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled={busyId === share.id} onSelect={() => void mutate(share.id, "revoke")} className={itemClass}><Ban /> Revoke link</DropdownMenuItem>
                        )}
                        <DropdownMenuItem disabled={busyId === share.id} onSelect={() => void mutate(share.id, "delete")} className={`${itemClass} text-[#c5221f] focus:bg-[#fce8e6] focus:text-[#c5221f]`}><Trash2 /> Delete permanently</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.className}`}>{state.label}</span>
                    <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1 text-xs font-semibold text-[#5f6368]">
                      <Eye className="mr-1 inline size-3.5" /> {share.view_count.toLocaleString()} views
                    </span>
                    <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1 text-xs font-semibold text-[#5f6368]">
                      <Download className="mr-1 inline size-3.5" /> {share.download_count.toLocaleString()}{share.max_downloads ? ` / ${share.max_downloads}` : ""}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-[#5f6368] sm:grid-cols-2">
                    <p className="flex items-center gap-2"><CalendarClock className="size-4 text-[#80868b]" /> {share.expires_at ? `Expires ${formatDate(share.expires_at)}` : "No expiration"}</p>
                    <p className="flex items-center gap-2"><Download className="size-4 text-[#80868b]" /> {share.allow_downloads ? "Downloads enabled" : "Preview only"}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!share.public_url}
                      onClick={() => void copyLink(share)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white transition hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copiedId === share.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copiedId === share.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      disabled={analyticsLoading}
                      onClick={() => void loadAnalytics(share)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60"
                    >
                      <Activity className="size-4" /> Analytics
                    </button>
                  </div>

                  {!share.public_url ? (
                    <p className="mt-3 rounded-xl bg-[#fef7e0] p-3 text-xs leading-5 text-[#8d4e00]">
                      This legacy link has no encrypted token copy. Create a new link to copy it from this dashboard.
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <QrModal share={qrShare} onClose={() => setQrShare(null)} />
      <AnalyticsModal analytics={analytics} loading={analyticsLoading} onClose={() => setAnalytics(null)} />
    </>
  );
}

function QrModal({ share, onClose }: { share: ShareListItem | null; onClose: () => void }) {
  const qrUrl = useMemo(() => {
    if (!share?.public_url) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(absoluteUrl(share.public_url))}`;
  }, [share]);
  return (
    <AnimatePresence>
      {share ? (
        <ModalShell title={`QR code · ${share.target_name}`} onClose={onClose}>
          <div className="grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} width={280} height={280} alt="Shared link QR code" className="rounded-2xl border border-[#e1e5ea] bg-white p-3" />
            <p className="mt-3 text-center text-xs text-[#80868b]">QR rendering uses api.qrserver.com.</p>
          </div>
        </ModalShell>
      ) : null}
    </AnimatePresence>
  );
}

function AnalyticsModal({ analytics, loading, onClose }: { analytics: Analytics | null; loading: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {analytics ? (
        <ModalShell title={`Analytics · ${analytics.share.target_name}`} onClose={onClose} wide>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Eye} label="Views" value={analytics.share.view_count} />
            <Stat icon={Download} label="Downloads" value={analytics.share.download_count} />
            <Stat icon={Activity} label="Events shown" value={analytics.events.length} />
          </div>
          <h3 className="mt-6 text-sm font-semibold text-[#202124]">Recent activity</h3>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {loading ? <p className="text-sm text-[#5f6368]">Loading activity…</p> : null}
            {!loading && !analytics.events.length ? <p className="rounded-2xl bg-[#f8f9fa] p-5 text-sm text-[#5f6368]">No tracked activity yet.</p> : null}
            {analytics.events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-[#e1e5ea] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0fe] text-[#1967d2]"><Activity className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold capitalize text-[#202124]">{event.event_type.replaceAll("_", " ")}</strong>
                  <small className="mt-1 block text-xs text-[#80868b]">{formatDateTime(event.created_at)}</small>
                </div>
              </div>
            ))}
          </div>
        </ModalShell>
      ) : null}
    </AnimatePresence>
  );
}

function ModalShell({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-[110] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section className={`max-h-[90vh] w-full overflow-y-auto rounded-[28px] border border-[#e1e5ea] bg-white p-5 shadow-2xl sm:p-6 ${wide ? "max-w-3xl" : "max-w-md"}`} initial={{ opacity: 0, y: 20, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }}>
        <header className="mb-5 flex items-center justify-between gap-3"><h2 className="truncate text-lg font-semibold text-[#202124]">{title}</h2><button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="Close"><X className="size-5" /></button></header>
        {children}
      </motion.section>
    </motion.div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return <div className="rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] p-4"><Icon className="size-5 text-[#1967d2]" /><strong className="mt-3 block text-2xl text-[#202124]">{value.toLocaleString()}</strong><span className="mt-1 block text-xs font-medium text-[#80868b]">{label}</span></div>;
}

function absoluteUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${window.location.origin}${value.startsWith("/") ? "" : "/"}${value}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function stateInfo(state: ShareListItem["state"]): { label: string; className: string } {
  if (state === "active") return { label: "Active", className: "bg-[#e6f4ea] text-[#137333]" };
  if (state === "revoked") return { label: "Revoked", className: "bg-[#fce8e6] text-[#a50e0e]" };
  if (state === "expired") return { label: "Expired", className: "bg-[#fef7e0] text-[#8d4e00]" };
  return { label: "Limit reached", className: "bg-[#fef7e0] text-[#8d4e00]" };
}

const itemClass = "min-h-10 cursor-pointer rounded-xl px-3 text-sm text-[#3c4043] focus:bg-[#f1f3f4] focus:text-[#202124]";
