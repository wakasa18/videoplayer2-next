"use client";

import type { AssignmentItem } from "@/lib/assignments/types";
import type { ImportantFile } from "@/lib/files/types";

const ASSIGNMENTS_KEY = "damons-archive:offline-assignments:v1";
const OFFLINE_FILES_KEY = "damons-archive:offline-files:v1";
const DB_NAME = "damons-archive-mobile";
const DB_VERSION = 1;
const UPLOAD_STORE = "upload-queue";

export type OfflineAssignmentSnapshot = {
  assignments: AssignmentItem[];
  updatedAt: string;
};

export type OfflineFileRecord = Pick<
  ImportantFile,
  "id" | "title" | "original_filename" | "mime_type" | "file_size" | "file_extension"
> & {
  cachedAt: string;
};

export type MobileUploadQueueItem = {
  id: string;
  file: File;
  folderPath: string;
  description: string;
  category: string;
  compress: boolean;
  createdAt: string;
  attempts: number;
  lastError: string;
};

export function mergeOfflineAssignments(assignments: AssignmentItem[]) {
  if (typeof window === "undefined" || !assignments.length) return;
  try {
    const existing = readOfflineAssignments().assignments;
    const map = new Map<number, AssignmentItem>();
    for (const assignment of existing) map.set(assignment.id, assignment);
    for (const assignment of assignments) map.set(assignment.id, assignment);
    const merged = Array.from(map.values())
      .filter((assignment) => !assignment.deleted_at)
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))
      .slice(0, 500);
    window.localStorage.setItem(
      ASSIGNMENTS_KEY,
      JSON.stringify({ assignments: merged, updatedAt: new Date().toISOString() } satisfies OfflineAssignmentSnapshot),
    );
  } catch {
    // Offline snapshots are best-effort and should never break the live page.
  }
}

export function readOfflineAssignments(): OfflineAssignmentSnapshot {
  if (typeof window === "undefined") return { assignments: [], updatedAt: "" };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ASSIGNMENTS_KEY) ?? "null") as OfflineAssignmentSnapshot | null;
    if (!parsed || !Array.isArray(parsed.assignments)) return { assignments: [], updatedAt: "" };
    return parsed;
  } catch {
    return { assignments: [], updatedAt: "" };
  }
}

export function readOfflineFiles(): OfflineFileRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OFFLINE_FILES_KEY) ?? "[]") as OfflineFileRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberOfflineFile(file: ImportantFile) {
  if (typeof window === "undefined") return;
  const records = readOfflineFiles().filter((item) => item.id !== file.id);
  records.unshift({
    id: file.id,
    title: file.title,
    original_filename: file.original_filename,
    mime_type: file.mime_type,
    file_size: file.file_size,
    file_extension: file.file_extension,
    cachedAt: new Date().toISOString(),
  });
  window.localStorage.setItem(OFFLINE_FILES_KEY, JSON.stringify(records.slice(0, 100)));
}

export function forgetOfflineFile(fileId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    OFFLINE_FILES_KEY,
    JSON.stringify(readOfflineFiles().filter((item) => item.id !== fileId)),
  );
}

export function clearOfflineSnapshots() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ASSIGNMENTS_KEY);
    window.localStorage.removeItem(OFFLINE_FILES_KEY);
  } catch {
    // Ignore storage cleanup failures during sign out.
  }
}

export async function enqueueMobileUpload(item: Omit<MobileUploadQueueItem, "id" | "createdAt" | "attempts" | "lastError">) {
  const db = await openMobileDb();
  const record: MobileUploadQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: "",
  };
  await idbRequest(db.transaction(UPLOAD_STORE, "readwrite").objectStore(UPLOAD_STORE).put(record));
  window.dispatchEvent(new CustomEvent("damons:upload-queue-changed"));
  return record;
}

export async function listMobileUploads(): Promise<MobileUploadQueueItem[]> {
  const db = await openMobileDb();
  const rows = await idbRequest<MobileUploadQueueItem[]>(db.transaction(UPLOAD_STORE, "readonly").objectStore(UPLOAD_STORE).getAll());
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateMobileUpload(item: MobileUploadQueueItem) {
  const db = await openMobileDb();
  await idbRequest(db.transaction(UPLOAD_STORE, "readwrite").objectStore(UPLOAD_STORE).put(item));
  window.dispatchEvent(new CustomEvent("damons:upload-queue-changed"));
}

export async function removeMobileUpload(id: string) {
  const db = await openMobileDb();
  await idbRequest(db.transaction(UPLOAD_STORE, "readwrite").objectStore(UPLOAD_STORE).delete(id));
  window.dispatchEvent(new CustomEvent("damons:upload-queue-changed"));
}

export async function clearMobileUploads() {
  const db = await openMobileDb();
  await idbRequest(db.transaction(UPLOAD_STORE, "readwrite").objectStore(UPLOAD_STORE).clear());
  window.dispatchEvent(new CustomEvent("damons:upload-queue-changed"));
}

function openMobileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(UPLOAD_STORE)) db.createObjectStore(UPLOAD_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the mobile queue database."));
  });
}

function idbRequest<T = undefined>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The offline database operation failed."));
  });
}
