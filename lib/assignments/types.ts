export type AssignmentStatus =
  | "to_do"
  | "in_progress"
  | "blocked"
  | "submitted"
  | "done";

export type AssignmentPriority = "low" | "medium" | "high";
export type AssignmentRecurrence =
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly";
export type AssignmentView = "list" | "board" | "calendar";
export type AssignmentTab =
  | "all"
  | "today"
  | "upcoming"
  | "overdue"
  | "no_deadline"
  | "completed";
export type AssignmentSort =
  | "due"
  | "priority"
  | "newest"
  | "oldest"
  | "alpha"
  | "subject";

export type AssignmentSubject = {
  id: number;
  owner_id?: string | null;
  name: string;
  code: string | null;
  instructor: string | null;
  color: string;
  schedule: string | null;
  semester: string | null;
  is_archived: boolean;
};

export type AssignmentSubtask = {
  id: number;
  assignment_id: number;
  title: string;
  is_done: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AssignmentNote = {
  id: number;
  assignment_id: number;
  content: string;
  is_pinned: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AssignmentAttachment = {
  id: number;
  title: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: string;
};

export type AssignmentItem = {
  id: number;
  owner_id?: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  subject: string | null;
  subject_id: number | null;
  subject_name: string;
  subject_code: string | null;
  subject_color: string;
  link_url: string | null;
  recurrence: AssignmentRecurrence | null;
  recurrence_series_id: string | null;
  recurrence_until: string | null;
  occurrence_index: number;
  generated_from_id: number | null;
  next_occurrence_id: number | null;
  reminder_due_at: string | null;
  reminder_sent_at: string | null;
  snoozed_until: string | null;
  notes_log: string | null;
  sort_order: number;
  completed_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  reminder_minutes_before: number;
  custom_reminder_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  subtask_total: number;
  subtask_done: number;
  note_count: number;
  attachment_count: number;
  search_text: string;
};

export type AssignmentDetails = {
  assignment: AssignmentItem;
  subject: AssignmentSubject | null;
  subtasks: AssignmentSubtask[];
  notes: AssignmentNote[];
  attachments: AssignmentAttachment[];
};

export type AssignmentFilters = {
  q: string;
  view: AssignmentView;
  tab: AssignmentTab;
  status: "" | AssignmentStatus;
  priority: "" | AssignmentPriority;
  subjectId: number;
  sort: AssignmentSort;
  page: number;
  perPage: number;
  month: string;
};

export type AssignmentSummary = {
  all: number;
  today: number;
  upcoming: number;
  overdue: number;
  noDeadline: number;
  completed: number;
  active: number;
};

export type AssignmentAnalytics = {
  completedWeek: number;
  completedMonth: number;
  onTimePercent: number;
  topSubject: string;
  topSubjectCount: number;
};

export type AssignmentBrowserResult = {
  assignments: AssignmentItem[];
  subjects: AssignmentSubject[];
  filters: AssignmentFilters;
  summary: AssignmentSummary;
  analytics: AssignmentAnalytics;
  totalResults: number;
  totalPages: number;
  page: number;
  truncated: boolean;
  accessMode: "service-role" | "session";
  legacySingleUserMode: boolean;
  optionalTablesMissing: string[];
};

export type AssignmentCollectionResult = {
  assignments: AssignmentItem[];
  subjects: AssignmentSubject[];
  accessMode: "service-role" | "session";
  optionalTablesMissing: string[];
};

export type AssignmentTemplate = {
  id: number;
  owner_id: string;
  name: string;
  title: string;
  description: string | null;
  priority: AssignmentPriority;
  recurrence: AssignmentRecurrence | null;
  subject_id: number | null;
  due_time: string | null;
  due_offset_days: number;
  reminder_minutes_before: number;
  link_url: string | null;
  is_archived: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AssignmentNotification = {
  id: number;
  assignment_id: number | null;
  event_type: "reminder" | "overdue" | "recurrence" | "digest" | "system";
  title: string;
  message: string;
  read_at: string | null;
  emailed_at: string | null;
  created_at: string;
  assignment_title: string | null;
  due_date: string | null;
  due_time: string | null;
};

export type AssignmentNotificationPreferences = {
  in_app_enabled: boolean;
  browser_enabled: boolean;
  email_enabled: boolean;
  email_address: string | null;
  daily_digest_enabled: boolean;
  digest_time: string;
  timezone: string;
};

export type AssignmentProductivityStats = {
  active: number;
  recurring: number;
  overdue: number;
  dueNext24Hours: number;
  remindersReady: number;
  completed7Days: number;
  completed30Days: number;
  completionRate30Days: number;
  currentStreak: number;
};

export type AssignmentProductivityData = {
  templates: AssignmentTemplate[];
  notifications: AssignmentNotification[];
  unreadCount: number;
  preferences: AssignmentNotificationPreferences;
  stats: AssignmentProductivityStats;
  recentAutomationRuns: Array<{
    id: number;
    run_source: string;
    reminders_created: number;
    recurrences_created: number;
    emails_requested: number;
    started_at: string;
    finished_at: string | null;
  }>;
};
