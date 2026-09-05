"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { PerformanceMonitor } from "@/components/quality/performance-monitor";
import { CommandPalette } from "@/components/command-palette";
import { SessionHeartbeat } from "@/components/security/session-heartbeat";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import type { WorkspaceDefaultModule } from "@/lib/workspace/types";

type AppShellProps = {
  children: ReactNode;
  userEmail: string;
  displayName?: string | null;
  quickModule?: WorkspaceDefaultModule;
  compactMode?: boolean;
};

const SIDEBAR_STORAGE_KEY = "damons-archive:sidebar-collapsed";

export function AppShell({
  children,
  userEmail,
  displayName,
  quickModule = "files",
  compactMode = false,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let storedCollapsed = false;
    try {
      storedCollapsed = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      // Storage can be unavailable in strict/private browser contexts.
    }

    const timer = window.setTimeout(() => setSidebarCollapsed(storedCollapsed), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.addEventListener("keydown", closeWithEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeWithEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Keep the UI functional even when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <div className="tech-shell min-h-screen text-slate-100">
      <PerformanceMonitor />
      <SessionHeartbeat />
      <CommandPalette />
      <TopBar
        userEmail={userEmail}
        displayName={displayName}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className="relative mx-auto flex max-w-[1720px] gap-4 px-3 pb-8 pt-4 sm:px-5 lg:gap-5 lg:px-6 lg:pt-5">
        <Sidebar
          quickModule={quickModule}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main-content"
            tabIndex={-1}
            key={pathname}
            className={
              compactMode
                ? "tech-page-transition min-w-0 flex-1 py-1"
                : "tech-page-transition min-w-0 flex-1 py-1"
            }
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className={`absolute inset-0 bg-[#020611]/78 backdrop-blur-md transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`relative h-full w-[min(88vw,340px)] p-2.5 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar mobile quickModule={quickModule} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>
    </div>
  );
}
