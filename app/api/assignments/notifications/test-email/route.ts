import { sendAssignmentTestEmail } from "@/lib/assignments/email";
import { consumeRateLimit } from "@/lib/maintenance/rate-limit";
import {
  assignmentErrorResponse,
  AssignmentRequestError,
  requireAssignmentWriteContext,
  sanitizeNullableText,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TestEmailPayload = {
  emailAddress?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const rateLimit = await consumeRateLimit(client, user.id, "assignment-email-test", 5, 3600);
    if (!rateLimit.allowed) {
      throw new AssignmentRequestError(
        `Too many test emails were requested. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        429,
      );
    }
    const payload = (await request.json().catch(() => ({}))) as TestEmailPayload;
    const email = sanitizeNullableText(payload.emailAddress, 320) ?? user.email ?? null;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new AssignmentRequestError("Enter a valid email address before sending a test.");
    }

    const result = await sendAssignmentTestEmail({ email, ownerId: user.id });
    if (!result.ok) {
      throw new AssignmentRequestError(
        result.error ?? "The test email could not be sent.",
        result.provider === "none" ? 503 : 502,
      );
    }

    return Response.json({
      success: true,
      provider: result.provider,
      messageId: result.messageId,
      email,
    });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
