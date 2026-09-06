"use client";

import { CloudUpload, RefreshCw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { compressMobileUpload } from "@/lib/mobile/compression";
import { listMobileUploads, removeMobileUpload, updateMobileUpload, type MobileUploadQueueItem } from "@/lib/mobile/offline-store";
import { saveGeneratedFileToArchive } from "@/lib/tools/generated-upload-client";

export function MobileUploadQueueManager() {
  const [items, setItems] = useState<MobileUploadQueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [online, setOnline] = useState(true);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    try { setItems(await listMobileUploads()); } catch { setItems([]); }
  }, []);

  const processQueue = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    setProcessing(true);
    try {
      const queue = await listMobileUploads();
      for (const item of queue) {
        try {
          const file = item.compress ? await compressMobileUpload(item.file) : item.file;
          await saveGeneratedFileToArchive(file, { folderPath: item.folderPath, description: item.description, category: item.category });
          await removeMobileUpload(item.id);
        } catch (error) {
          await updateMobileUpload({ ...item, attempts: item.attempts + 1, lastError: error instanceof Error ? error.message : "Upload retry failed." });
          break;
        }
      }
    } finally {
      running.current = false;
      setProcessing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      void refresh().then(() => processQueue());
    }, 0);
    const handleOnline = () => { setOnline(true); void processQueue(); };
    const handleOffline = () => setOnline(false);
    const changed = () => void refresh();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("damons:upload-queue-changed", changed);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("damons:upload-queue-changed", changed);
    };
  }, [processQueue, refresh]);

  if (!items.length && !processing) return null;
  return (
    <div className="fixed bottom-[calc(5.55rem+env(safe-area-inset-bottom))] left-3 z-[82] lg:bottom-4 lg:left-auto lg:right-4">
      <button type="button" onClick={() => void processQueue()} className="flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/20 bg-[#071426]/96 px-3.5 text-xs font-semibold text-slate-200 shadow-[0_16px_46px_rgba(0,0,0,.5)] backdrop-blur-xl">
        {!online ? <WifiOff className="size-4 text-amber-300" /> : processing ? <RefreshCw className="size-4 animate-spin text-cyan-200" /> : <CloudUpload className="size-4 text-cyan-200" />}
        {processing ? "Retrying uploads…" : `${items.length} upload${items.length === 1 ? "" : "s"} queued`}
      </button>
    </div>
  );
}
