"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SessionHeartbeat() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function beat() {
      try {
        const response = await fetch("/api/security/sessions/heartbeat", { method: "POST" });
        if (response.status === 401 && active) {
          router.replace("/auth/login");
          router.refresh();
        }
      } catch {
        // Session heartbeat is best-effort; normal auth still protects the app.
      }
    }
    void beat();
    const timer = window.setInterval(() => void beat(), 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
