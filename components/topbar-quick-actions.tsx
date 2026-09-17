"use client"

import type { ReactNode } from "react"

import { FolderOpen, FolderPlus, Plus, StickyNote, Upload, Video, Wrench } from "@/components/ui/icons"
import { usePathname, useRouter } from "next/navigation"

import {
  FloatingPanelBody,
  FloatingPanelButton,
  FloatingPanelCloseButton,
  FloatingPanelContent,
  FloatingPanelFooter,
  FloatingPanelRoot,
  FloatingPanelTrigger,
} from "@/components/ui/floating-panel"

export function TopBarQuickActions() {
  const pathname = usePathname()
  const router = useRouter()

  const openFileCommand = (command: "upload" | "new-folder") => {
    if (
      pathname.startsWith("/dashboard/files") &&
      !pathname.startsWith("/dashboard/files/recycle") &&
      !pathname.startsWith("/dashboard/files/shares")
    ) {
      window.dispatchEvent(
        new CustomEvent(
          command === "upload" ? "damons:upload-files" : "damons:new-folder"
        )
      )
      return
    }
    router.push(`/dashboard/files?command=${command}`)
  }

  const navigate = (href: string) => router.push(href)

  return (
    <FloatingPanelRoot className="shrink-0">
      <FloatingPanelTrigger
        title="Quick actions"
        aria-label="Open quick actions"
        className="topbar-icon-button size-10 px-0 sm:w-auto sm:px-3"
      >
        <Plus className="size-4" aria-hidden="true" />
        <span className="hidden text-xs font-medium sm:inline">Create</span>
      </FloatingPanelTrigger>

      <FloatingPanelContent className="w-[18rem]">
        <FloatingPanelBody className="space-y-1 p-2">
          <FloatingPanelButton onClick={() => openFileCommand("upload")}>
            <ActionIcon><Upload className="size-4" /></ActionIcon>
            <ActionCopy title="Upload files" detail="Add files to Important Files" />
          </FloatingPanelButton>
          <FloatingPanelButton onClick={() => openFileCommand("new-folder")}>
            <ActionIcon><FolderPlus className="size-4" /></ActionIcon>
            <ActionCopy title="New folder" detail="Create a folder in the archive" />
          </FloatingPanelButton>
          <FloatingPanelButton onClick={() => navigate("/dashboard/files")}>
            <ActionIcon><FolderOpen className="size-4" /></ActionIcon>
            <ActionCopy title="Important Files" detail="Open your private archive" />
          </FloatingPanelButton>
          <FloatingPanelButton onClick={() => navigate("/dashboard/tools")}>
            <ActionIcon><Wrench className="size-4" /></ActionIcon>
            <ActionCopy title="Archive Tools" detail="Convert, edit, and manage files" />
          </FloatingPanelButton>
          <FloatingPanelButton onClick={() => navigate("/dashboard/notes?new=1")}>
            <ActionIcon><StickyNote className="size-4" /></ActionIcon>
            <ActionCopy title="New note" detail="Write a note or schedule a reminder" />
          </FloatingPanelButton>
          <FloatingPanelButton onClick={() => navigate("/dashboard/videos")}>
            <ActionIcon><Video className="size-4" /></ActionIcon>
            <ActionCopy title="Videos" detail="Open your video library" />
          </FloatingPanelButton>
        </FloatingPanelBody>
        <FloatingPanelFooter>
          <FloatingPanelCloseButton label="Close" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/35">
            Workspace shortcuts
          </span>
        </FloatingPanelFooter>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  )
}

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-primary/85 shadow-[inset_0_1px_0_rgba(255,255,255,.10)] backdrop-blur-md">
      {children}
    </span>
  )
}

function ActionCopy({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <strong className="block truncate text-xs font-semibold text-slate-100">{title}</strong>
      <span className="mt-0.5 block truncate text-[10px] text-slate-500">{detail}</span>
    </span>
  )
}
