import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match application requests except framework assets, local Lordicon
     * animations, and common images. Icons also animate on public auth pages.
     * API routes still pass through the session refresh logic, but the proxy
     * does not convert their 401 responses into HTML login redirects.
     */
    "/((?!_next/static|_next/image|lordicon/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
