"use client";

import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { PullToRefresh } from "@/components/mobile/pull-to-refresh";
import { PwaManager } from "@/components/mobile/pwa-manager";
import { MobileUploadQueueManager } from "@/components/mobile/upload-queue-manager";

export function MobileEnhancements() {
  return <><PwaManager /><PullToRefresh /><MobileUploadQueueManager /><MobileBottomNav /></>;
}
