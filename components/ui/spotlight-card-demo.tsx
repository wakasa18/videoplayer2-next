"use client";

import { FileArchive, FolderOpen, ShieldCheck } from "@/components/ui/icons";

import { GlowCard } from "@/components/ui/spotlight-card";

const examples = [
  { icon: FolderOpen, title: "Important Files", detail: "Pointer-reactive purple spotlight" },
  { icon: FileArchive, title: "Archive Tools", detail: "Works at any responsive card size" },
  { icon: ShieldCheck, title: "Download Safety", detail: "No additional UI dependency required" },
];

export function Default() {
  return (
    <div className="grid min-h-screen w-full place-items-center bg-card p-6">
      <div className="grid w-full max-w-5xl gap-5 md:grid-cols-3">
        {examples.map(({ icon: Icon, title, detail }) => (
          <GlowCard
            key={title}
            glowColor="purple"
            customSize
            className="min-h-56 w-full overflow-hidden rounded-[24px] border-white/10 p-5"
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <span className="grid size-11 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}

export default Default;
