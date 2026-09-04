"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const logout = async () => {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={logout}
      disabled={isLoading}
      className="h-10 rounded-xl border border-white/[0.09] bg-white/[0.035] px-2.5 text-slate-400 hover:bg-white/[0.075] hover:text-slate-100 sm:h-11 sm:px-3"
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden 2xl:inline">
        {isLoading ? "Signing out..." : "Sign out"}
      </span>
    </Button>
  );
}
