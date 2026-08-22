import {
  requireWorkspaceWriteContext,
  WorkspaceRequestError,
  workspaceErrorResponse,
  writeWorkspaceSecurityEvent,
} from "@/lib/workspace/server";

type PasswordPayload = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const { sessionClient, client, user, accessMode } =
      await requireWorkspaceWriteContext(request);
    const payload = (await request.json()) as PasswordPayload;
    const currentPassword = String(payload.currentPassword ?? "");
    const newPassword = String(payload.newPassword ?? "");

    if (!user.email) {
      throw new WorkspaceRequestError(
        "This account does not have an email/password login.",
        409,
      );
    }
    if (!currentPassword) {
      throw new WorkspaceRequestError("Enter your current password.");
    }
    if (newPassword.length < 8) {
      throw new WorkspaceRequestError(
        "The new password must contain at least 8 characters.",
      );
    }
    if (currentPassword === newPassword) {
      throw new WorkspaceRequestError(
        "Choose a new password that is different from the current password.",
      );
    }

    const { error: verifyError } = await sessionClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      throw new WorkspaceRequestError("The current password is incorrect.", 403);
    }

    const { error: updateError } = await sessionClient.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      throw new WorkspaceRequestError(updateError.message, 422);
    }

    await writeWorkspaceSecurityEvent(client, user.id, "account_password_changed", {
      access_mode: accessMode,
    });

    return Response.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
