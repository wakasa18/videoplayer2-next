"use client";

import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Film,
  HardDrive,
  KeyRound,
  Loader2,
  Save,
  Share2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import type {
  WorkspaceDefaultModule,
  WorkspaceSettingsData,
} from "@/lib/workspace/types";
import { formatBytes } from "@/lib/workspace/utils";

const TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

const DEFAULT_MODULES: Array<{
  value: WorkspaceDefaultModule;
  label: string;
}> = [
  { value: "home", label: "Home dashboard" },
  { value: "files", label: "Important Files" },
  { value: "assignments", label: "Assignments" },
  { value: "videos", label: "Videos" },
  { value: "activity", label: "Activity" },
];

export function WorkspaceSettingsClient({ data }: { data: WorkspaceSettingsData }) {
  const router = useRouter();
  const [profile, setProfile] = useState(data.profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const quotaPercent = useMemo(() => {
    if (data.quotaBytes <= 0) return 0;
    return Math.min(100, (data.summary.total_bytes / data.quotaBytes) * 100);
  }, [data.quotaBytes, data.summary.total_bytes]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profile.display_name,
          timezone: profile.timezone,
          weekStartsOn: profile.week_starts_on,
          defaultModule: profile.default_module,
          compactMode: profile.compact_mode,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        profile?: typeof profile;
      };
      if (!response.ok) throw new Error(payload.error ?? "Settings could not be saved.");
      if (payload.profile) setProfile(payload.profile);
      setProfileMessage("Workspace settings saved.");
      router.refresh();
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Settings could not be saved.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordMessage("The new passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/workspace/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Password could not be changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated successfully.");
      router.refresh();
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : "Password could not be changed.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
      <div className="space-y-5">
        <form
          onSubmit={saveProfile}
          className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#202124]">Workspace preferences</h2>
              <p className="mt-1 text-sm leading-6 text-[#5f6368]">
                These settings are stored privately for your Supabase account.
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
              <Save className="size-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Display name">
              <input
                value={profile.display_name ?? ""}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    display_name: event.target.value,
                  }))
                }
                maxLength={100}
                autoComplete="name"
                className={inputClass}
                placeholder="Your name"
              />
            </Field>

            <Field label="Account email">
              <input value={data.email} disabled className={`${inputClass} bg-[#f8f9fa]`} />
            </Field>

            <Field label="Timezone">
              <select
                value={profile.timezone}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
                className={inputClass}
              >
                {TIMEZONES.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Week starts on">
              <select
                value={profile.week_starts_on}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    week_starts_on: Number(event.target.value),
                  }))
                }
                className={inputClass}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={6}>Saturday</option>
              </select>
            </Field>

            <Field label="Preferred quick-launch module">
              <select
                value={profile.default_module}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    default_module: event.target.value as WorkspaceDefaultModule,
                  }))
                }
                className={inputClass}
              >
                {DEFAULT_MODULES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#dadce0] px-4 py-3 text-sm text-[#3c4043]">
              <input
                type="checkbox"
                checked={profile.compact_mode}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    compact_mode: event.target.checked,
                  }))
                }
                className="size-4 accent-[#1a73e8]"
              />
              Prefer compact lists
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className={`text-sm ${
                profileMessage.toLowerCase().includes("saved")
                  ? "text-[#137333]"
                  : "text-[#b3261e]"
              }`}
            >
              {profileMessage}
            </p>
            <button type="submit" disabled={savingProfile} className={primaryButtonClass}>
              {savingProfile ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save settings
            </button>
          </div>
        </form>

        <form
          onSubmit={changePassword}
          className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#202124]">Change password</h2>
              <p className="mt-1 text-sm leading-6 text-[#5f6368]">
                Your current password is verified before the new password is saved.
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fce8e6] text-[#b3261e]">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            <Field label="Current password">
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              {showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
            <button type="submit" disabled={savingPassword} className={primaryButtonClass}>
              {savingPassword ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              Update password
            </button>
          </div>
          <p
            aria-live="polite"
            className={`mt-3 text-sm ${
              passwordMessage.toLowerCase().includes("success")
                ? "text-[#137333]"
                : "text-[#b3261e]"
            }`}
          >
            {passwordMessage}
          </p>
        </form>
      </div>

      <div className="space-y-5">
        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#202124]">Storage usage</h2>
              <p className="mt-1 text-sm text-[#5f6368]">
                Active and recycled files both consume Storage space.
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e6f4ea] text-[#137333]">
              <HardDrive className="size-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <strong className="text-2xl font-semibold text-[#202124]">
                {formatBytes(data.summary.total_bytes)}
              </strong>
              <span className="text-xs font-semibold text-[#80868b]">
                of {formatBytes(data.quotaBytes)}
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edf1f5]">
              <div
                className="h-full rounded-full bg-[#1a73e8] transition-[width]"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#80868b]">
              {quotaPercent.toFixed(1)}% of the configured workspace quota
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <StorageStat
              icon={FileText}
              label="Important files"
              value={data.summary.file_count}
              detail={formatBytes(data.summary.file_bytes)}
            />
            <StorageStat
              icon={Film}
              label="Videos"
              value={data.summary.video_count}
              detail={formatBytes(data.summary.video_bytes)}
            />
            <StorageStat
              icon={Archive}
              label="Recycle Bin"
              value={data.summary.file_recycle_count + data.summary.video_recycle_count}
              detail="Items still stored"
            />
            <StorageStat
              icon={Share2}
              label="Active links"
              value={data.summary.active_share_count}
              detail="Public share links"
            />
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#202124]">Metadata backup</h2>
              <p className="mt-1 text-sm leading-6 text-[#5f6368]">
                Download account settings and module metadata as JSON. Private file and video bytes are not included.
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fef7e0] text-[#a15c00]">
              <Download className="size-5" aria-hidden="true" />
            </span>
          </div>

          <a
            href="/api/workspace/export"
            className={`${primaryButtonClass} mt-5 w-full justify-center`}
          >
            <Download className="size-4" aria-hidden="true" />
            Download JSON backup
          </a>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#5f6368]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#137333]" />
            The export route checks your signed-in account and applies owner filters to every query.
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#3c4043]">
      {label}
      {children}
    </label>
  );
}

function StorageStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9fa] p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#1967d2] shadow-sm">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[#80868b]">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-[#202124]">
          {value.toLocaleString()} · {detail}
        </p>
      </div>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-[#dadce0] bg-white px-4 text-sm font-normal text-[#202124] outline-none transition placeholder:text-[#9aa0a6] focus:border-[#1a73e8] focus:ring-4 focus:ring-[#e8f0fe] disabled:cursor-not-allowed disabled:text-[#80868b]";

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1765cc] disabled:cursor-not-allowed disabled:opacity-60";
