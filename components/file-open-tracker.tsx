"use client";

import { useEffect } from "react";

export function FileOpenTracker({ fileId }: { fileId: number }) {
  useEffect(() => {
    void fetch(`/api/files/${fileId}/activity`, { method: "POST" }).catch(() => undefined);
  }, [fileId]);
  return null;
}
