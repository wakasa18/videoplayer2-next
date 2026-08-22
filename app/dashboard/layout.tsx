import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceDefaultModule } from "@/lib/workspace/types";
import { WORKSPACE_DEFAULT_MODULES } from "@/lib/workspace/utils";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("workspace_profiles")
    .select("display_name,default_module,compact_mode")
    .eq("owner_id", user.id)
    .maybeSingle();

  const requestedModule = String(profile?.default_module ?? "files") as WorkspaceDefaultModule;
  const quickModule = WORKSPACE_DEFAULT_MODULES.has(requestedModule)
    ? requestedModule
    : "files";

  return (
    <AppShell
      userEmail={user.email ?? "Account"}
      displayName={
        typeof profile?.display_name === "string" ? profile.display_name : null
      }
      quickModule={quickModule}
      compactMode={Boolean(profile?.compact_mode)}
    >
      {children}
    </AppShell>
  );
}
