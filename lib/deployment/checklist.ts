export type DeploymentChecklistItem = {
  key: string;
  category: string;
  label: string;
  required: boolean;
};

export const PHASE9_SMOKE_TESTS: DeploymentChecklistItem[] = [
  { key: "metadata_backup", category: "Pre-cutover", label: "Download and safely store a current metadata backup", required: true },
  { key: "production_build", category: "Pre-cutover", label: "npm run build completes without errors", required: true },
  { key: "system_check", category: "Pre-cutover", label: "System Check has no red failures", required: true },
  { key: "auth_redirects", category: "Pre-cutover", label: "Supabase Site URL and redirect URLs match production", required: true },
  { key: "storage_private", category: "Pre-cutover", label: "File and video buckets remain private with owner-scoped access", required: true },
  { key: "public_health", category: "Deployment", label: "Public /api/health returns status ok", required: true },
  { key: "deep_health", category: "Deployment", label: "Authenticated deep health check confirms database and Storage", required: true },
  { key: "login_logout", category: "Authentication", label: "Login, session refresh, and logout work on production", required: true },
  { key: "password_reset", category: "Authentication", label: "Password reset link returns to the production domain", required: false },
  { key: "files_flow", category: "Important Files", label: "Upload, preview, download, rename, move, and delete a test file", required: true },
  { key: "share_flow", category: "Important Files", label: "Create and open a public share, then revoke it", required: true },
  { key: "assignment_flow", category: "Assignments", label: "Create, edit, complete, archive, and restore a test assignment", required: true },
  { key: "assignment_cron", category: "Assignments", label: "Assignment automation endpoint is authorized and completes", required: true },
  { key: "video_flow", category: "Videos", label: "Upload, play, seek, download, and delete a test video", required: true },
  { key: "settings_flow", category: "Workspace", label: "Profile and workspace settings save and reload", required: true },
  { key: "activity_flow", category: "Workspace", label: "Recent test actions appear in Activity", required: true },
  { key: "mobile_layout", category: "User experience", label: "Dashboard, files, assignments, and videos work on mobile width", required: true },
  { key: "browser_check", category: "User experience", label: "Critical flows pass in a second modern browser", required: false },
  { key: "broken_links", category: "Cutover", label: "No unresolved missing Storage objects remain", required: true },
  { key: "old_system_frozen", category: "Cutover", label: "Old system is read-only or unavailable before final data transfer", required: true },
  { key: "final_delta", category: "Cutover", label: "Final database and Storage delta has been transferred and verified", required: true },
  { key: "rollback_ready", category: "Cutover", label: "Previous deployment and rollback instructions are available", required: true },
  { key: "post_launch_watch", category: "Monitoring", label: "A post-launch health and error monitoring owner and procedure are ready", required: true },
];
