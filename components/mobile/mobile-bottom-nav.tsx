"use client";

import { ClipboardList, FolderOpen, Home } from "@/components/ui/icons";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { QuickCaptureSheet } from "@/components/mobile/quick-capture-sheet";
import { LordIcon, type LordIconName } from "@/components/ui/lord-icon";

const navSpring = {
  type: "spring" as const,
  stiffness: 460,
  damping: 36,
  mass: 0.72,
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <motion.nav
        aria-label="Mobile primary navigation"
        className="
          mobile-bottom-nav
          fixed inset-x-3
          bottom-[max(.55rem,env(safe-area-inset-bottom))]
          z-[80]
          mx-auto max-w-md
          rounded-[1.35rem]
          border border-primary/15
          bg-card/[.992]
          px-1.5 py-1.5
          shadow-[0_18px_52px_rgba(0,0,0,.58)]
          lg:hidden
        "
        initial={{ opacity: 0, y: 22, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 360,
          damping: 34,
          mass: 0.78,
        }}
      >
        <div className="grid grid-cols-5 items-center">
          <NavItem
            href="/dashboard"
            label="Home"
            icon={Home}
            lordicon="home"
            active={pathname === "/dashboard"}
          />

          <NavItem
            href="/dashboard/files"
            label="Files"
            icon={FolderOpen}
            lordicon="files"
            active={pathname.startsWith("/dashboard/files")}
          />

          {/* Smaller center Upload button */}
          <motion.button
            id="mobile-bottom-upload"
            type="button"
            onClick={() => setUploadOpen(true)}
            className="
              group
              -mt-1.5
              flex min-h-11 min-w-0
              flex-col items-center justify-center
              gap-0.5
              text-[9px] font-semibold
              text-primary
            "
            whileTap={{ scale: 0.93 }}
            transition={navSpring}
            aria-label="Open quick upload"
          >
            <motion.span
              className="
                mobile-upload-action
                relative
                grid size-10
                place-items-center
                rounded-[.8rem]
                border border-primary/30
                workspace-primary
                text-white
                shadow-[0_8px_20px_rgba(155, 41, 255, .28)]
              "
              animate={
                uploadOpen
                  ? { rotate: 45, scale: 0.95 }
                  : { rotate: 0, scale: 1 }
              }
              transition={navSpring}
            >
              <span
                className="
                  pointer-events-none
                  absolute inset-1
                  rounded-[.55rem]
                  border border-white/15
                  opacity-70
                "
              />

              <LordIcon
                name="upload"
                size={18}
                active={uploadOpen}
                targetId="mobile-bottom-upload"
                className="relative text-white"
              />
            </motion.span>

            <span className="max-w-full truncate leading-none">
              Upload
            </span>
          </motion.button>

          <NavItem
            href="/dashboard/assignments"
            label="Tasks"
            icon={ClipboardList}
            lordicon="assignments"
            active={pathname.startsWith("/dashboard/assignments")}
          />

          <motion.button
            id="mobile-bottom-more"
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new Event("damons:open-mobile-nav")
              )
            }
            className="
              relative
              flex min-h-12 min-w-0
              flex-col items-center justify-center
              gap-0.5
              rounded-xl
              text-[9px] font-semibold
              text-slate-500
            "
            whileTap={{ scale: 0.92 }}
            transition={navSpring}
            aria-label="Open more navigation"
          >
            <motion.span
              whileTap={{ rotate: -8 }}
              transition={navSpring}
            >
              <LordIcon
                name="tools"
                size={18}
                targetId="mobile-bottom-more"
                className="text-slate-400"
              />
            </motion.span>

            <span className="max-w-full truncate">
              More
            </span>
          </motion.button>
        </div>
      </motion.nav>

      <QuickCaptureSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </MotionConfig>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  lordicon,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  lordicon?: LordIconName;
}) {
  const animationTargetId = `mobile-bottom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <Link
      id={animationTargetId}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`
        group relative
        flex min-h-12 min-w-0
        items-stretch
        rounded-xl
        text-[9px] font-semibold
        transition-colors duration-200
        ${
          active
            ? "text-primary"
            : "text-slate-500"
        }
      `}
    >
      {active ? (
        <motion.span
          layoutId="mobile-nav-active-pill"
          className="
            pointer-events-none
            absolute inset-0.5
            rounded-[.9rem]
            border border-primary/15
            bg-primary/10
            shadow-[inset_0_1px_0_rgba(255,255,255,.04)]
          "
          transition={navSpring}
        />
      ) : null}

      <motion.span
        className="
          relative z-10
          flex min-w-0 flex-1
          flex-col items-center justify-center
          gap-0.5
        "
        whileTap={{ scale: 0.92 }}
        animate={active ? { y: -1 } : { y: 0 }}
        transition={navSpring}
      >
        <motion.span
          animate={active ? { scale: 1.08 } : { scale: 1 }}
          transition={navSpring}
        >
          {lordicon ? (
            <LordIcon
              name={lordicon}
              size={18}
              active={active}
              targetId={animationTargetId}
            />
          ) : (
            <Icon className="size-[18px]" />
          )}
        </motion.span>

        <span className="max-w-full truncate">
          {label}
        </span>

        <motion.span
          className="
            absolute bottom-0.5
            h-0.5 rounded-full
            bg-primary
          "
          animate={
            active
              ? { width: 14, opacity: 1 }
              : { width: 0, opacity: 0 }
          }
          transition={navSpring}
        />
      </motion.span>
    </Link>
  );
}
