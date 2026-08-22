"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ShareType } from "@/lib/shares/types";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  shareType: ShareType;
  fileId?: number;
  folderPath?: string;
  targetName: string;
};

type Result = { id: number; publicUrl: string; targetName: string };

export function ShareDialog({
  open,
  onClose,
  shareType,
  fileId,
  folderPath,
  targetName,
}: ShareDialogProps) {
  const [expiresAt, setExpiresAt] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [shareTitle, setShareTitle] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const qrUrl = useMemo(
    () =>
      result
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(result.publicUrl)}`
        : "",
    [result],
  );

  function close() {
    if (busy) return;
    setResult(null);
    setError("");
    setCopied(false);
    setShowQr(false);
    onClose();
  }

  async function createShare() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareType,
          fileId,
          folderPath,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          maxDownloads: maxDownloads || null,
          allowDownloads,
          shareTitle,
          shareMessage,
          displayName,
        }),
      });
      const payload = (await response.json()) as Result & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create the shared link.");
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the shared link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${targetName}`}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#e1e5ea] bg-white shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <header className="flex items-start gap-4 border-b border-[#eef1f3] p-5 sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
                <Link2 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold tracking-[-.02em] text-[#202124]">
                  Share {targetName}
                </h2>
                <p className="mt-1 text-sm text-[#5f6368]">
                  Create a secure public link without exposing your Supabase Storage bucket.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid size-10 shrink-0 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
                aria-label="Close share dialog"
              >
                <X className="size-5" />
              </button>
            </header>

            {result ? (
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start gap-3 rounded-2xl border border-[#cee9d4] bg-[#e6f4ea] p-4 text-[#137333]">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <strong className="block text-sm">Shared link created</strong>
                    <p className="mt-1 text-xs leading-5">
                      Only people who have this link can open the shared {shareType}.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-3">
                  <label className="text-xs font-semibold text-[#5f6368]">Public link</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      readOnly
                      value={result.publicUrl}
                      className="min-w-0 flex-1 rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#202124] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
                    >
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={result.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
                  >
                    <ExternalLink className="size-4" /> Open link
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowQr((value) => !value)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
                  >
                    <QrCode className="size-4" /> {showQr ? "Hide QR" : "Show QR"}
                  </button>
                </div>

                <AnimatePresence>
                  {showQr ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid place-items-center rounded-2xl border border-[#e1e5ea] bg-white p-5">
                        {/* The QR image service receives only the public share URL. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt="QR code for shared link" width={260} height={260} className="rounded-xl" />
                        <p className="mt-3 text-center text-xs text-[#80868b]">
                          QR rendering uses api.qrserver.com.
                        </p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="min-h-11 rounded-full bg-[#1a73e8] px-6 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field icon={CalendarClock} label="Expiration (optional)">
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field icon={Download} label="Download limit (optional)">
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={maxDownloads}
                      onChange={(event) => setMaxDownloads(event.target.value)}
                      placeholder="Unlimited"
                      className={inputClass}
                    />
                  </Field>
                  <Field icon={Link2} label="Public title">
                    <input
                      value={shareTitle}
                      onChange={(event) => setShareTitle(event.target.value)}
                      placeholder={targetName}
                      maxLength={255}
                      className={inputClass}
                    />
                  </Field>
                  <Field icon={UserRound} label="Shared by">
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Your display name"
                      maxLength={100}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field icon={MessageSquareText} label="Message">
                  <textarea
                    value={shareMessage}
                    onChange={(event) => setShareMessage(event.target.value)}
                    placeholder="Add an optional note for people opening the link"
                    maxLength={5000}
                    rows={4}
                    className={`${inputClass} resize-y py-3`}
                  />
                </Field>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4">
                  <input
                    type="checkbox"
                    checked={allowDownloads}
                    onChange={(event) => setAllowDownloads(event.target.checked)}
                    className="mt-1 size-4 accent-[#1a73e8]"
                  />
                  <span>
                    <strong className="block text-sm font-semibold text-[#202124]">Allow downloads</strong>
                    <small className="mt-1 block text-xs leading-5 text-[#5f6368]">
                      Preview remains available when downloads are disabled.
                    </small>
                  </span>
                </label>

                {error ? (
                  <div className="rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] p-4 text-sm text-[#a50e0e]">
                    {error}
                  </div>
                ) : null}

                <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={close}
                    className="min-h-11 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createShare()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0] disabled:opacity-60"
                  >
                    <Link2 className="size-4" /> {busy ? "Creating…" : "Create shared link"}
                  </button>
                </footer>
              </div>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Link2;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#5f6368]">
        <Icon className="size-4 text-[#1967d2]" /> {label}
      </span>
      {children}
    </label>
  );
}


const inputClass =
  "min-h-11 w-full rounded-xl border border-[#dadce0] bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-[#9aa0a6] focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]";
