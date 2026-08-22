"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Loader2,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type {
  AssignmentNotification,
  AssignmentNotificationPreferences,
} from "@/lib/assignments/types";

const EMPTY_PREFERENCES: AssignmentNotificationPreferences = {
  in_app_enabled: true,
  browser_enabled: false,
  email_enabled: false,
  email_address: null,
  daily_digest_enabled: true,
  digest_time: "07:00",
  timezone: "Asia/Manila",
};

export function AssignmentNotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<AssignmentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const seenIds = useRef<Set<number>>(new Set());
  const initialized = useRef(false);

  async function loadFeed(showBrowserNotifications = true) {
    try {
      const response = await fetch("/api/assignments/notifications?limit=12", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        notifications: AssignmentNotification[];
        unreadCount: number;
        preferences: AssignmentNotificationPreferences;
      };
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
      setPreferences(payload.preferences);

      if (
        showBrowserNotifications &&
        initialized.current &&
        payload.preferences.browser_enabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        for (const notification of payload.notifications) {
          if (!notification.read_at && !seenIds.current.has(notification.id)) {
            new Notification(notification.title, {
              body: notification.message,
              tag: `assignment-${notification.id}`,
              icon: "/favicon.ico",
            });
          }
        }
      }
      seenIds.current = new Set(payload.notifications.map((item) => item.id));
      initialized.current = true;
    } catch (error) {
      // A request can be interrupted briefly while Next.js recompiles in development.
      // Keep the current notification state and avoid an unhandled promise rejection.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.warn("Unable to refresh assignment notifications.", error);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeed(false);
    const timer = window.setInterval(() => void loadFeed(true), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  async function markAllRead() {
    if (busy || unreadCount === 0) return;
    setBusy(true);
    try {
      const response = await fetch("/api/assignments/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!response.ok) return;
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, read_at: readAt })));
      setUnreadCount(0);
    } catch (error) {
      console.warn("Unable to mark assignment notifications as read.", error);
    } finally {
      setBusy(false);
    }
  }

  async function markRead(notification: AssignmentNotification) {
    if (notification.read_at) return;
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await fetch(`/api/assignments/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
    } catch (error) {
      console.warn("Unable to update the assignment notification.", error);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unreadCount ? `${unreadCount} unread assignment notifications` : "Assignment notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d2e3fc]"
      >
        {unreadCount ? <BellRing className="size-5 text-[#1967d2]" /> : <Bell className="size-5" />}
        {unreadCount ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#d93025] px-1 text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              onClick={() => setOpen(false)}
            />
            <motion.section
              role="dialog"
              aria-label="Assignment notifications"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-x-3 top-[68px] z-50 max-h-[min(76vh,620px)] overflow-hidden rounded-[24px] border border-[#e1e5ea] bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]"
            >
              <header className="flex items-center gap-3 border-b border-[#eef1f3] px-4 py-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
                  <BellRing className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-[#202124]">Assignment notifications</h2>
                  <p className="text-xs text-[#80868b]">{unreadCount} unread</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4] sm:hidden"
                >
                  <X className="size-4" />
                </button>
              </header>

              <div className="flex items-center justify-between gap-3 border-b border-[#eef1f3] px-4 py-2.5">
                <Link
                  href="/dashboard/assignments/productivity"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1967d2] hover:underline"
                >
                  <Settings2 className="size-3.5" /> Settings and templates
                </Link>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={busy || unreadCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#3c4043] hover:bg-[#f1f3f4] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                  Mark all read
                </button>
              </div>

              <div className="max-h-[470px] overflow-y-auto p-2">
                {loading ? (
                  <div className="grid min-h-40 place-items-center text-[#80868b]">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : notifications.length ? (
                  <div className="space-y-1">
                    {notifications.map((notification) => {
                      const content = (
                        <>
                          <span
                            className={`mt-1 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-transparent" : "bg-[#1a73e8]"}`}
                          />
                          <span className="min-w-0 flex-1">
                            <strong className="block text-sm font-semibold text-[#202124]">
                              {notification.title}
                            </strong>
                            <span className="mt-1 block text-xs leading-5 text-[#5f6368]">
                              {notification.message}
                            </span>
                            <span className="mt-1.5 block text-[11px] text-[#9aa0a6]">
                              {formatRelative(notification.created_at)}
                            </span>
                          </span>
                          {notification.assignment_id ? (
                            <ChevronRight className="mt-1 size-4 shrink-0 text-[#9aa0a6]" />
                          ) : null}
                        </>
                      );
                      return notification.assignment_id ? (
                        <Link
                          key={notification.id}
                          href={`/dashboard/assignments/${notification.assignment_id}`}
                          onClick={() => {
                            void markRead(notification);
                            setOpen(false);
                          }}
                          className={`flex gap-3 rounded-2xl px-3 py-3 transition hover:bg-[#f8f9fa] ${notification.read_at ? "" : "bg-[#f6f9fe]"}`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => void markRead(notification)}
                          className={`flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#f8f9fa] ${notification.read_at ? "" : "bg-[#f6f9fe]"}`}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid min-h-44 place-items-center px-6 text-center">
                    <div>
                      <Bell className="mx-auto size-7 text-[#9aa0a6]" />
                      <p className="mt-3 text-sm font-semibold text-[#3c4043]">No notifications yet</p>
                      <p className="mt-1 text-xs leading-5 text-[#80868b]">
                        Reminders and recurring-task updates will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!preferences.in_app_enabled ? (
                <div className="border-t border-[#eef1f3] bg-[#fef7e0] px-4 py-3 text-xs text-[#7a4f01]">
                  In-app reminders are currently disabled in Productivity settings.
                </div>
              ) : null}
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function formatRelative(value: string): string {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  if (Number.isNaN(difference)) return value;
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}
