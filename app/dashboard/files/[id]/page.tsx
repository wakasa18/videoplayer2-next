import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileKey,
  FolderOpen,
  HardDrive,
  Star,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FileItemActions } from "@/components/file-item-actions";
import { FilePreview } from "@/components/file-preview";
import { FileTypeIcon } from "@/components/file-type-icon";
import { getImportantFileById } from "@/lib/files/data";
import {
  buildFileQuery,
  formatBytes,
  formatDate,
  getFileExtension,
} from "@/lib/files/utils";

type FileDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function FileDetailsPage({ params }: FileDetailsPageProps) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id < 1) notFound();

  const { file } = await getImportantFileById(id);
  if (!file) notFound();

  const backUrl = buildFileQuery(
    {
      folder: file.folder_path ?? "",
      q: "",
      type: "",
      category: "",
      favorite: false,
      sort: "newest",
      view: "grid",
      page: 1,
      perPage: 24,
    },
    {},
  );

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backUrl}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to files
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/files/${file.id}/download`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Download className="size-4" aria-hidden="true" />
            Download
          </a>
          <FileItemActions file={file} />
        </div>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <FileTypeIcon
            file={file}
            className="size-16 rounded-[20px]"
            iconClassName="size-8"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold tracking-[-0.025em] text-slate-100 sm:text-3xl">
                {file.title}
              </h1>
              {file.is_favorite ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                  <Star className="size-3.5 fill-current" aria-hidden="true" />
                  Favorite
                </span>
              ) : null}
            </div>
            <p className="mt-2 break-all text-sm text-slate-400">
              {file.original_filename}
            </p>
            {file.description ? (
              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-400">
                {file.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <section className="min-w-0 rounded-[28px] border border-white/10 bg-white/[0.045] p-3 shadow-sm sm:p-5">
          <FilePreview file={file} />
        </section>

        <aside className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
              File information
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">Details</h2>
          </div>

          <Detail
            icon={HardDrive}
            label="Size"
            value={formatBytes(file.file_size)}
          />
          <Detail
            icon={FileKey}
            label="Type"
            value={`${getFileExtension(file).toUpperCase() || "FILE"} · ${file.mime_type}`}
          />
          <Detail
            icon={FolderOpen}
            label="Folder"
            value={file.folder_path || "Important Files root"}
          />
          <Detail
            icon={CalendarDays}
            label="Uploaded"
            value={formatDate(file.created_at)}
          />
          <Detail
            icon={CalendarDays}
            label="Last updated"
            value={formatDate(file.updated_at ?? file.created_at)}
          />

          {file.category ? (
            <div className="rounded-2xl bg-white/[0.035] p-4">
              <span className="text-xs font-semibold text-slate-400">Category</span>
              <strong className="mt-1 block text-sm text-slate-100">
                {file.category}
              </strong>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-400">{label}</span>
        <strong className="mt-1 block break-words text-sm font-semibold text-slate-100">
          {value}
        </strong>
      </span>
    </div>
  );
}
