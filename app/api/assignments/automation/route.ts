import { NextResponse } from "next/server";

import { processAssignmentAutomation } from "@/lib/assignments/automation";
import {
  assignmentErrorResponse,
  AssignmentRequestError,
  requireAssignmentWriteContext,
} from "@/lib/assignments/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      throw new AssignmentRequestError("CRON_SECRET is not configured.", 503);
    }
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization !== `Bearer ${secret}`) {
      throw new AssignmentRequestError("Unauthorized automation request.", 401);
    }

    const admin = createAdminClient();
    if (!admin) {
      throw new AssignmentRequestError(
        "SUPABASE_SECRET_KEY (or a service-role key) is required for scheduled automation.",
        503,
      );
    }

    const result = await processAssignmentAutomation(admin, { source: "cron" });
    return NextResponse.json(
      { success: true, checkedAt: new Date().toISOString(), ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const result = await processAssignmentAutomation(client, {
      ownerId: user.id,
      source: "manual",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
