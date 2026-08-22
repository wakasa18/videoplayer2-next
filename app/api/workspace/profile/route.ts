import {
  requireWorkspaceWriteContext,
  WorkspaceRequestError,
  workspaceErrorResponse,
  writeWorkspaceSecurityEvent,
} from "@/lib/workspace/server";
import type { WorkspaceDefaultModule, WorkspaceProfile } from "@/lib/workspace/types";
import {
  isValidTimezone,
  WORKSPACE_DEFAULT_MODULES,
} from "@/lib/workspace/utils";

type ProfilePayload = {
  displayName?: unknown;
  timezone?: unknown;
  weekStartsOn?: unknown;
  defaultModule?: unknown;
  compactMode?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const { client, user, accessMode } = await requireWorkspaceWriteContext(request);
    const payload = (await request.json()) as ProfilePayload;

    const displayName = String(payload.displayName ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 100);
    if (!displayName) {
      throw new WorkspaceRequestError("Enter a display name.");
    }

    const timezone = String(payload.timezone ?? "").trim().slice(0, 80);
    if (!timezone || !isValidTimezone(timezone)) {
      throw new WorkspaceRequestError("Select a valid timezone.");
    }

    const weekStartsOn = Number(payload.weekStartsOn);
    if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
      throw new WorkspaceRequestError("Select a valid first day of the week.");
    }

    const defaultModule = String(payload.defaultModule ?? "home") as WorkspaceDefaultModule;
    if (!WORKSPACE_DEFAULT_MODULES.has(defaultModule)) {
      throw new WorkspaceRequestError("Select a valid default module.");
    }

    const compactMode = Boolean(payload.compactMode);
    const { data, error } = await client
      .from("workspace_profiles")
      .upsert(
        {
          owner_id: user.id,
          display_name: displayName,
          timezone,
          week_starts_on: weekStartsOn,
          default_module: defaultModule,
          compact_mode: compactMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      )
      .select(
        "owner_id,display_name,timezone,week_starts_on,default_module,compact_mode,created_at,updated_at",
      )
      .single();

    if (error) throw new WorkspaceRequestError(error.message, 422);

    await writeWorkspaceSecurityEvent(client, user.id, "workspace_profile_updated", {
      display_name: displayName,
      timezone,
      week_starts_on: weekStartsOn,
      default_module: defaultModule,
      compact_mode: compactMode,
      access_mode: accessMode,
    });

    return Response.json({ success: true, profile: data as WorkspaceProfile });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
