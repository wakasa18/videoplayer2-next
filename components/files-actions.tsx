"use client";

import { FolderPlus, FolderUp, Upload } from "lucide-react";
import { useState } from "react";

import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { UploadDialog } from "@/components/upload-dialog";

type FilesActionsProps = {
  currentFolder: string;
  categories: string[];
  maxUploadBytes: number;
  folderTableAvailable: boolean;
};

type UploadMode = "files" | "folder";

export function FilesActions({
  currentFolder,
  categories,
  maxUploadBytes,
  folderTableAvailable,
}: FilesActionsProps) {
  const [uploadMode, setUploadMode] = useState<UploadMode | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setUploadMode("files")}
          className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#1557b0] hover:shadow-md active:translate-y-0"
        >
          <Upload className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden="true" />
          Upload files
        </button>
        <button
          type="button"
          onClick={() => setUploadMode("folder")}
          className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f8f9fa] hover:shadow-sm active:translate-y-0"
        >
          <FolderUp className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden="true" />
          Upload folder
        </button>
        <button
          type="button"
          disabled={!folderTableAvailable}
          title={
            folderTableAvailable
              ? "Create an empty folder"
              : "Run the Phase 3A SQL file first"
          }
          onClick={() => setFolderOpen(true)}
          className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f8f9fa] hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <FolderPlus className="size-4 transition-transform duration-200 group-hover:scale-105" aria-hidden="true" />
          New folder
        </button>
      </div>

      <UploadDialog
        open={uploadMode !== null}
        mode={uploadMode ?? "files"}
        onOpenChange={(open) => {
          if (!open) setUploadMode(null);
        }}
        currentFolder={currentFolder}
        categories={categories}
        maxUploadBytes={maxUploadBytes}
      />
      <CreateFolderDialog
        open={folderOpen}
        onOpenChange={setFolderOpen}
        parentPath={currentFolder}
      />
    </>
  );
}
