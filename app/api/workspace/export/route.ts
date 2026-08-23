import {
  requireWorkspaceWriteContext,
  workspaceErrorResponse,
  writeWorkspaceSecurityEvent,
} from "@/lib/workspace/server";

type ResultLike = {
  data: unknown;
  error: { message: string } | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { sessionClient, client, user, accessMode } =
      await requireWorkspaceWriteContext(request);

    const [
      profileResult,
      summaryResult,
      filesResult,
      foldersResult,
      sharesResult,
      assignmentsResult,
      subjectsResult,
      videosResult,
      activityResult,
      deploymentReleasesResult,
      deploymentTestsResult,
      deploymentEventsResult,
      maintenanceRunsResult,
      backupVerificationsResult,
    ] = await Promise.all([
      client
        .from("workspace_profiles")
        .select(
          "display_name,timezone,week_starts_on,default_module,compact_mode,created_at,updated_at",
        )
        .eq("owner_id", user.id)
        .maybeSingle(),
      sessionClient.rpc("get_workspace_summary"),
      client
        .from("important_files")
        .select(
          "id,title,description,category,folder_path,original_filename,file_extension,mime_type,file_size,status,document_date,expires_at,is_favorite,download_count,created_at,updated_at,deleted_at",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000),
      client
        .from("important_folders")
        .select("id,path,name,parent_path,status,created_at,updated_at,deleted_at")
        .eq("owner_id", user.id)
        .order("path", { ascending: true })
        .limit(10000),
      client
        .from("important_file_shares")
        .select(
          "id,share_type,file_id,folder_path,expires_at,max_downloads,allow_downloads,share_title,share_message,display_name,view_count,download_count,last_accessed_at,revoked_at,created_at,updated_at",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000),
      client
        .from("assignments")
        .select(
          "id,title,description,due_date,due_time,status,priority,subject_id,link_url,recurrence,recurrence_until,reminder_due_at,reminder_sent_at,snoozed_until,completed_at,archived_at,deleted_at,reminder_minutes_before,custom_reminder_at,created_at,updated_at",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000),
      client
        .from("assignment_subjects")
        .select("id,name,code,instructor,color,schedule,semester,is_archived")
        .eq("owner_id", user.id)
        .order("name", { ascending: true })
        .limit(1000),
      client
        .from("videos")
        .select(
          "id,title,description,category,original_filename,mime_type,file_size,duration_seconds,status,is_favorite,view_count,download_count,created_at,updated_at,deleted_at,finalized_at,last_viewed_at",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000),
      sessionClient.rpc("get_workspace_activity", {
        p_module: null,
        p_query: null,
        p_limit: 100,
        p_offset: 0,
      }),
      client
        .from("deployment_releases")
        .select("id,release_tag,environment,status,deployment_url,commit_sha,notes,started_at,deployed_at,completed_at,rolled_back_at,created_at,updated_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("deployment_smoke_tests")
        .select("release_id,test_key,category,label,required,status,detail,checked_at,created_at,updated_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      client
        .from("deployment_events")
        .select("release_id,event_type,message,metadata,created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      client
        .from("maintenance_runs")
        .select("id,run_type,status,summary,report,started_at,completed_at,created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
      client
        .from("backup_verifications")
        .select("filename,schema_name,backup_version,status,counts,warnings,verified_at")
        .eq("owner_id", user.id)
        .order("verified_at", { ascending: false })
        .limit(500),
    ]);

    const warnings: string[] = [];
    const backup = {
      schema: "damons-archive-phase10-metadata-backup",
      version: 3,
      generated_at: new Date().toISOString(),
      account: {
        user_id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
      },
      profile: collect("profile", profileResult, warnings),
      summary: collect("summary", summaryResult, warnings),
      important_files: collect("important_files", filesResult, warnings),
      important_folders: collect("important_folders", foldersResult, warnings),
      public_shares: collect("public_shares", sharesResult, warnings),
      assignments: collect("assignments", assignmentsResult, warnings),
      assignment_subjects: collect("assignment_subjects", subjectsResult, warnings),
      videos: collect("videos", videosResult, warnings),
      recent_activity: collect("recent_activity", activityResult, warnings),
      deployment_releases: collect("deployment_releases", deploymentReleasesResult, warnings),
      deployment_smoke_tests: collect("deployment_smoke_tests", deploymentTestsResult, warnings),
      deployment_events: collect("deployment_events", deploymentEventsResult, warnings),
      maintenance_runs: collect("maintenance_runs", maintenanceRunsResult, warnings),
      backup_verifications: collect("backup_verifications", backupVerificationsResult, warnings),
      warnings,
      note: "This backup contains metadata only. Private Storage objects and authentication secrets are not included.",
    };

    await writeWorkspaceSecurityEvent(client, user.id, "workspace_metadata_exported", {
      format: "json",
      warning_count: warnings.length,
      access_mode: accessMode,
    });

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="damons-archive-backup-${date}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

function collect(label: string, result: ResultLike, warnings: string[]): unknown {
  if (result.error) {
    warnings.push(`${label}: ${result.error.message}`);
    return null;
  }
  return result.data ?? null;
}
