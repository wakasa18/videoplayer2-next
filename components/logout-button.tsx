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
      className="h-10 rounded-full px-3 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">
        {isLoading ? "Signing out..." : "Sign out"}
      </span>
    </Button>
  );
}
