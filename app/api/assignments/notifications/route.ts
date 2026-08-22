import { NextResponse } from "next/server";

import { getAssignmentNotificationFeed } from "@/lib/assignments/productivity";
import {
  assignmentErrorResponse,
  AssignmentRequestError,
  requireAssignmentWriteContext,
  sanitizeNullableText,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "12", 10) || 12, 1), 50);
    return NextResponse.json(await getAssignmentNotificationFeed(limit));
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

type PatchPayload = {
  action?: "mark_all_read" | "preferences";
  inAppEnabled?: unknown;
  browserEnabled?: unknown;
  emailEnabled?: unknown;
  emailAddress?: unknown;
  dailyDigestEnabled?: unknown;
  digestTime?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as PatchPayload;
    const action = String(payload.action ?? "");

    if (action === "mark_all_read") {
      const { error } = await client
        .from("assignment_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("owner_id", user.id)
        .is("read_at", null);
      if (error) throw new AssignmentRequestError(error.message, 422);
      return NextResponse.json({ success: true });
    }

    if (action === "preferences") {
      const digestTime = String(payload.digestTime ?? "07:00").trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(digestTime)) {
        throw new AssignmentRequestError("Select a valid digest time.");
      }
      const emailAddress = sanitizeNullableText(payload.emailAddress, 320);
      if (Boolean(payload.emailEnabled) && (!emailAddress || !/^\S+@\S+\.\S+$/.test(emailAddress))) {
        throw new AssignmentRequestError("Enter a valid email address for email reminders.");
      }
      const now = new Date().toISOString();
      const { error } = await client
        .from("assignment_notification_preferences")
        .upsert(
          {
            owner_id: user.id,
            in_app_enabled: Boolean(payload.inAppEnabled),
            browser_enabled: Boolean(payload.browserEnabled),
            email_enabled: Boolean(payload.emailEnabled),
            email_address: emailAddress,
            daily_digest_enabled: Boolean(payload.dailyDigestEnabled),
            digest_time: digestTime,
            timezone: "Asia/Manila",
            updated_at: now,
          },
          { onConflict: "owner_id" },
        );
      if (error) throw new AssignmentRequestError(error.message, 422);
      return NextResponse.json({ success: true });
    }

    throw new AssignmentRequestError("Unsupported notification action.");
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
