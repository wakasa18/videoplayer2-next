"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { PerformanceMonitor } from "@/components/quality/performance-monitor";
import { MobileEnhancements } from "@/components/mobile/mobile-enhancements";
import { CommandPalette } from "@/components/command-palette";
import { SessionHeartbeat } from "@/components/security/session-heartbeat";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { ModalPortal } from "@/components/ui/modal-portal";
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
    const openMobileNav = () => setMobileOpen(true);
    window.addEventListener("damons:open-mobile-nav", openMobileNav);
    return () => window.removeEventListener("damons:open-mobile-nav", openMobileNav);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
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
    <MotionConfig reducedMotion="user">
    <div className="archive-workspace tech-shell min-h-screen text-slate-100">
      <PerformanceMonitor />
      <SessionHeartbeat />
      <CommandPalette />
      <MobileEnhancements />
      <div className="relative z-10">
      <TopBar
        userEmail={userEmail}
        displayName={displayName}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className="archive-shell-content">
        <Sidebar
          quickModule={quickModule}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

          <main
            id="main-content"
            tabIndex={-1}
            key={pathname}
            className={
              compactMode
                ? "archive-main archive-main-compact tech-page-transition min-w-0 flex-1"
                : "archive-main tech-page-transition min-w-0 flex-1"
            }
          >
            {children}
          </main>
      </div>

      </div>

      <ModalPortal>
      <AnimatePresence>
      {mobileOpen ? <motion.div key="mobile-navigation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="archive-workspace archive-navigation-overlay tech-modal-overlay fixed inset-0 z-[110] lg:hidden">
        <button
          type="button"
          data-no-glass
          aria-label="Close navigation"
          tabIndex={-1}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="tech-modal-surface relative h-full w-[min(86vw,300px)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
        >
          <Sidebar mobile quickModule={quickModule} onNavigate={() => setMobileOpen(false)} />
        </motion.div>
      </motion.div> : null}
      </AnimatePresence>
      </ModalPortal>
    </div>
    </MotionConfig>
  );
}
