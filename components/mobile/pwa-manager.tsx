"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "damons-archive:pwa-install-dismissed";
const APP_CACHE_PREFIX = "damons-";

async function clearDevelopmentPwaState() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(APP_CACHE_PREFIX))
        .map((cacheName) => caches.delete(cacheName)),
    );
  }
}

export function PwaManager() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Never let a service worker control the Next.js development server.
    // Turbopack reuses development chunk URLs while their contents change,
    // so a cache-first worker can serve an old client bundle beside fresh
    // server HTML and trigger hydration mismatches.
    if (process.env.NODE_ENV !== "production") {
      void clearDevelopmentPwaState().catch(() => undefined);
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;

    if (standalone || window.localStorage.getItem(DISMISS_KEY) === "true") return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      const timer = window.setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 1200);
      return () => window.clearTimeout(timer);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setPromptEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(6.2rem+env(safe-area-inset-bottom))] z-[85] mx-auto max-w-md rounded-2xl border border-cyan-300/20 bg-[#081425]/96 p-3 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur-xl lg:hidden">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
          {iosHint ? <Share className="size-5" /> : <Download className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="text-sm text-slate-100">Install Damon&apos;s Archive</strong>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {iosHint
              ? "On iPhone, tap Share, then Add to Home Screen for an app-like experience."
              : "Install this workspace for faster launch and offline access."}
          </p>
          {promptEvent ? (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-2 min-h-9 rounded-full bg-cyan-300 px-4 text-xs font-bold text-[#04111d]"
            >
              Install app
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[.06] hover:text-slate-200"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
