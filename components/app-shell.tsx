"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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

export function AppShell({
  children,
  userEmail,
  displayName,
  quickModule = "files",
  compactMode = false,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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

  return (
    <div className="tech-shell min-h-screen text-slate-100">
      <TopBar
        userEmail={userEmail}
        displayName={displayName}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className="relative mx-auto flex max-w-[1720px] gap-5 px-3 pb-8 pt-5 sm:px-5 lg:px-6">
        <Sidebar quickModule={quickModule} />
        <main className={compactMode ? "min-w-0 flex-1 py-1" : "min-w-0 flex-1 py-1"}>
          {children}
        </main>
      </div>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className={`absolute inset-0 bg-[#020611]/75 backdrop-blur-md transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`relative h-full w-[min(88vw,340px)] p-3 transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar mobile quickModule={quickModule} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>
    </div>
  );
}
