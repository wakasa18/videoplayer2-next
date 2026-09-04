export type WorkspaceDefaultModule =
  | "home"
  | "files"
  | "assignments"
  | "videos"
  | "activity";

export type WorkspaceProfile = {
  owner_id: string;
  display_name: string | null;
  timezone: string;
  week_starts_on: number;
  default_module: WorkspaceDefaultModule;
  compact_mode: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkspaceSummary = {
  file_count: number;
  file_recycle_count: number;
  file_bytes: number;
  video_count: number;
  video_recycle_count: number;
  video_bytes: number;
  assignment_count: number;
  active_share_count: number;
  total_bytes: number;
};

export type WorkspaceActivityModule =
  | "files"
  | "assignments"
  | "videos"
  | "security";

export type WorkspaceActivityItem = {
  activity_key: string;
  module: WorkspaceActivityModule;
  action: string;
  target_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
  total_count: number;
};

export type WorkspaceActivityFilters = {
  module: "" | WorkspaceActivityModule;
  q: string;
  page: number;
  perPage: number;
};

export type WorkspaceActivityResult = {
  items: WorkspaceActivityItem[];
  filters: WorkspaceActivityFilters;
  totalItems: number;
  totalPages: number;
  page: number;
};


export type DashboardHomeAssignment = {
  id: number;
  title: string;
  due_date: string;
  due_time: string | null;
  status: "to_do" | "in_progress" | "blocked";
  priority: "low" | "medium" | "high";
  subject: string | null;
};

export type DashboardHomeData = {
  displayName: string;
  timezone: string;
  quotaBytes: number;
  summary: WorkspaceSummary;
  upcomingAssignments: DashboardHomeAssignment[];
  recentActivity: WorkspaceActivityItem[];
};

export type WorkspaceSettingsData = {
  email: string;
  profile: WorkspaceProfile;
  summary: WorkspaceSummary;
  quotaBytes: number;
};
