import { AlertTriangle } from "lucide-react";

import { ToolsHub } from "@/components/tools/tools-hub";
import { getToolArchiveFiles } from "@/lib/files/data";

export const metadata = { title: "Tools · Damon's Archive" };
export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  try {
    const files = await getToolArchiveFiles();
    return <main><ToolsHub archiveFiles={files} /></main>;
  } catch (error) {
    return (
      <main className="grid min-h-[65vh] place-items-center">
        <section className="tech-panel w-full max-w-2xl rounded-[22px] p-5 sm:rounded-[28px] sm:p-7">
          <AlertTriangle className="size-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-100">Archive Tools unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {error instanceof Error ? error.message : "Could not load files for Archive Tools."}
          </p>
        </section>
      </main>
    );
  }
}
