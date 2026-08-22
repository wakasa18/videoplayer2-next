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
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124]">
      <TopBar
        userEmail={userEmail}
        displayName={displayName}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar quickModule={quickModule} />

        <div
          className={
            compactMode
              ? "min-w-0 flex-1 px-3 py-4 sm:px-4 lg:px-6"
              : "min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"
          }
        >
          {children}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`relative h-full w-[min(86vw,320px)] bg-white shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar
            mobile
            quickModule={quickModule}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
