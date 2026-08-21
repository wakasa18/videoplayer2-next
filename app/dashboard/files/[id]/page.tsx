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
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to files
        </Link>
        <a
          href={`/api/files/${file.id}/download`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
        >
          <Download className="size-4" aria-hidden="true" />
          Download
        </a>
      </div>

      <section className="rounded-[28px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <FileTypeIcon
            file={file}
            className="size-16 rounded-[20px]"
            iconClassName="size-8"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold tracking-[-0.025em] text-[#202124] sm:text-3xl">
                {file.title}
              </h1>
              {file.is_favorite ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs font-semibold text-[#a15c00]">
                  <Star className="size-3.5 fill-current" aria-hidden="true" />
                  Favorite
                </span>
              ) : null}
            </div>
            <p className="mt-2 break-all text-sm text-[#80868b]">
              {file.original_filename}
            </p>
            {file.description ? (
              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#5f6368]">
                {file.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <section className="min-w-0 rounded-[28px] border border-[#e1e5ea] bg-white p-3 shadow-sm sm:p-5">
          <FilePreview file={file} />
        </section>

        <aside className="space-y-4 rounded-[28px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#80868b]">
              File information
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#202124]">Details</h2>
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
            <div className="rounded-2xl bg-[#f8f9fa] p-4">
              <span className="text-xs font-semibold text-[#80868b]">Category</span>
              <strong className="mt-1 block text-sm text-[#202124]">
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
    <div className="flex items-start gap-3 rounded-2xl border border-[#eef1f3] p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0fe] text-[#1967d2]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[#80868b]">{label}</span>
        <strong className="mt-1 block break-words text-sm font-semibold text-[#202124]">
          {value}
        </strong>
      </span>
    </div>
  );
}
