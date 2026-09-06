"use client";

import {
  Activity,
  BellRing,
  Boxes,
  Command,
  FileClock,
  FolderOpen,
  Home,
  Keyboard,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ModalPortal } from "@/components/ui/modal-portal";

type PaletteCommand = {
  id: string;
  label: string;
  detail: string;
  keywords: string;
  icon: typeof Home;
  shortcut?: string;
  href?: string;
  action?: "upload" | "new-folder";
};

const COMMANDS: PaletteCommand[] = [
  { id: "home", label: "Dashboard", detail: "Open workspace home", keywords: "home dashboard", icon: Home, shortcut: "Alt+H", href: "/dashboard" },
  { id: "files", label: "Important Files", detail: "Browse private files", keywords: "files documents drive", icon: FolderOpen, shortcut: "Alt+F", href: "/dashboard/files" },
  { id: "recent", label: "Recent Files", detail: "Files you recently opened, previewed, or downloaded", keywords: "recent history files", icon: FileClock, shortcut: "Alt+R", href: "/dashboard/files/recent" },
  { id: "upload", label: "Upload files", detail: "Open the resumable upload queue", keywords: "upload add file", icon: Upload, shortcut: "Alt+U", action: "upload" },
  { id: "new-folder", label: "Create folder", detail: "Create a folder in Important Files", keywords: "new create folder directory", icon: FolderOpen, shortcut: "Alt+N", action: "new-folder" },
  { id: "assignments", label: "Assignments", detail: "Open assignment workspace", keywords: "assignments tasks deadline", icon: BellRing, shortcut: "Alt+A", href: "/dashboard/assignments" },
  { id: "reminders", label: "Reminder History", detail: "Review sent and failed reminder emails", keywords: "reminder email failed history cron", icon: BellRing, href: "/dashboard/assignments/reminders" },
  { id: "videos", label: "Videos", detail: "Open video library", keywords: "videos media", icon: Video, shortcut: "Alt+V", href: "/dashboard/videos" },
  { id: "tools", label: "Archive Tools", detail: "File converter, image toolkit, and ZIP manager", keywords: "tools converter image archive zip extract", icon: Boxes, shortcut: "Alt+T", href: "/dashboard/tools" },
  { id: "activity", label: "Activity", detail: "Review workspace activity", keywords: "activity audit events", icon: Activity, href: "/dashboard/activity" },
  { id: "security", label: "Security Center", detail: "Sessions and login history", keywords: "security sessions login history devices", icon: ShieldCheck, href: "/dashboard/security" },
  { id: "system", label: "System Health", detail: "Check database, Storage, cron, and email health", keywords: "system health cron smtp database", icon: Wrench, href: "/dashboard/system" },
  { id: "settings", label: "Settings", detail: "Workspace preferences and backup tools", keywords: "settings backup restore", icon: Settings, href: "/dashboard/settings" },
];

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
}

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const triggerFileCommand = useCallback((action: "upload" | "new-folder") => {
    if (window.location.pathname.startsWith("/dashboard/files") && !window.location.pathname.startsWith("/dashboard/files/recycle") && !window.location.pathname.startsWith("/dashboard/files/shares")) {
      window.dispatchEvent(new CustomEvent(action === "upload" ? "damons:upload-files" : "damons:new-folder"));
      return;
    }
    router.push(`/dashboard/files?command=${action}`);
  }, [router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey) return;
      if (!event.altKey) return;
      const key = event.key.toLowerCase();
      const shortcutMap: Record<string, string> = {
        h: "/dashboard",
        f: "/dashboard/files",
        r: "/dashboard/files/recent",
        a: "/dashboard/assignments",
        v: "/dashboard/videos",
        t: "/dashboard/tools",
      };
      if (shortcutMap[key]) {
        event.preventDefault();
        router.push(shortcutMap[key]);
      } else if (key === "u") {
        event.preventDefault();
        triggerFileCommand("upload");
      } else if (key === "n") {
        event.preventDefault();
        triggerFileCommand("new-folder");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, router, triggerFileCommand]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const commands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COMMANDS;
    return COMMANDS.filter((command) => `${command.label} ${command.detail} ${command.keywords}`.toLowerCase().includes(normalized));
  }, [query]);

  function run(command: PaletteCommand) {
    setOpen(false);
    setQuery("");
    if (command.href) router.push(command.href);
    else if (command.action) triggerFileCommand(command.action);
  }


  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 hidden items-center gap-2 rounded-full border border-cyan-300/15 bg-[#0b1322]/92 px-3.5 py-2 text-[11px] font-semibold text-slate-300 shadow-[0_16px_40px_rgba(0,0,0,.35)] backdrop-blur-xl transition hover:border-cyan-300/30 hover:text-cyan-100 xl:inline-flex"
        aria-label="Open command palette"
        title="Command palette (Ctrl+K)"
      >
        <Command className="size-3.5 text-cyan-300" /> Ctrl+K
      </button>
      <ModalPortal>
        {open ? (
          <div className="tech-modal-overlay fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto p-3 pt-[10dvh] sm:p-6 sm:pt-[12dvh]" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
            <section role="dialog" aria-modal="true" aria-label="Command palette" className="tech-modal-surface w-full max-w-2xl overflow-hidden rounded-[26px] border shadow-[0_30px_100px_rgba(0,0,0,.6)]">
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
                <Search className="size-5 shrink-0 text-cyan-300" />
                <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands, pages, and actions…" className="min-h-10 min-w-0 flex-1 border-0 !bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
                <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/[.06] hover:text-white"><X className="size-4.5" /></button>
              </div>
              <div className="max-h-[58dvh] overflow-y-auto p-2.5">
                {commands.length ? commands.map((command) => {
                  const Icon = command.icon;
                  return <button key={command.id} type="button" onClick={() => run(command)} className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-cyan-300/15 hover:bg-cyan-300/[.055]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-slate-400 group-hover:text-cyan-200"><Icon className="size-4.5" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-slate-100">{command.label}</strong><small className="mt-0.5 block truncate text-xs text-slate-500">{command.detail}</small></span>
                    {command.shortcut ? <kbd className="hidden rounded-lg border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline-flex">{command.shortcut}</kbd> : null}
                  </button>;
                }) : <div className="grid min-h-40 place-items-center text-center text-sm text-slate-500">No matching command.</div>}
              </div>
              <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3 text-[10px] text-slate-500 sm:px-5">
                <span className="inline-flex items-center gap-1.5"><Keyboard className="size-3.5" /> Keyboard shortcuts</span>
                <span>Alt+F files</span><span>Alt+A assignments</span><span>Alt+T tools</span><span>Alt+U upload</span><span>Alt+N folder</span>
              </footer>
            </section>
          </div>
        ) : null}
      </ModalPortal>
    </>
  );
}
