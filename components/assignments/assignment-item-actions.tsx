"use client";

import {
  Archive,
  CheckCircle2,
  CircleDot,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AssignmentEditorDialog } from "@/components/assignments/assignment-editor-dialog";
import type { AssignmentItem, AssignmentSubject } from "@/lib/assignments/types";

export function AssignmentItemActions({
  assignment,
  subjects,
}: {
  assignment: AssignmentItem;
  subjects: AssignmentSubject[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: "archive" | "trash" | "status", status?: string) {
    if (busy) return;
    if (action === "trash" && !window.confirm(`Move “${assignment.title}” to the Recycle Bin?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "status" ? { action, status } : { action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The assignment could not be updated.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The assignment could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className="grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
          aria-label={`Actions for ${assignment.title}`}
          aria-expanded={open}
        >
          <MoreVertical className="size-5" />
        </button>
        {open ? (
          <div className="absolute right-0 top-11 z-30 w-52 rounded-2xl border border-[#e1e5ea] bg-white p-2 shadow-xl">
            <MenuButton icon={Pencil} label="Edit" onClick={() => { setEditing(true); setOpen(false); }} />
            <MenuButton icon={CircleDot} label="Mark in progress" onClick={() => run("status", "in_progress")} disabled={busy} />
            <MenuButton icon={CheckCircle2} label="Mark done" onClick={() => run("status", "done")} disabled={busy} />
            <MenuButton icon={Archive} label="Archive" onClick={() => run("archive")} disabled={busy} />
            <MenuButton icon={Trash2} label="Move to Recycle Bin" onClick={() => run("trash")} disabled={busy} danger />
          </div>
        ) : null}
      </div>
      <AssignmentEditorDialog open={editing} assignment={assignment} subjects={subjects} onClose={() => setEditing(false)} />
    </>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition hover:bg-[#f1f3f4] disabled:opacity-50 ${danger ? "text-[#c5221f]" : "text-[#3c4043]"}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
