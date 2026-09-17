"use client";

import {
  Activity, BadgeCheck, Boxes, ChevronDown, ClipboardList, FileClock,
  FlaskConical, FolderOpen, History, Home, Link2, PanelLeftClose,
  PanelLeftOpen, Rocket, Settings, ShieldCheck, Sparkles, StickyNote,
  Upload, Video, Wrench, X,
} from "@/components/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LordIcon, type LordIconName } from "@/components/ui/lord-icon";
import type { WorkspaceDefaultModule } from "@/lib/workspace/types";

type NavigationLink = { href: string; label: string; icon: typeof Home; lordicon: LordIconName; exact?: boolean };

const workspaceLinks: NavigationLink[] = [
  { href: "/dashboard", label: "Overview", icon: Home, lordicon: "home", exact: true },
  { href: "/dashboard/files", label: "Important files", icon: FolderOpen, lordicon: "files" },
  { href: "/dashboard/videos", label: "Video library", icon: Video, lordicon: "video" },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList, lordicon: "assignments" },
  { href: "/dashboard/notes", label: "Notes", icon: StickyNote, lordicon: "notes" },
];
const organizeLinks: NavigationLink[] = [
  { href: "/dashboard/files/recent", label: "Recent files", icon: FileClock, lordicon: "recent" },
  { href: "/dashboard/files/shares", label: "Shared links", icon: Link2, lordicon: "share" },
  { href: "/dashboard/assignments/productivity", label: "Productivity", icon: Sparkles, lordicon: "productivity" },
  { href: "/dashboard/assignments/reminders", label: "Reminder history", icon: History, lordicon: "reminder" },
  { href: "/dashboard/tools", label: "Archive tools", icon: Boxes, lordicon: "tools" },
];
const accountLinks: NavigationLink[] = [
  { href: "/dashboard/activity", label: "Activity", icon: Activity, lordicon: "activity" },
  { href: "/dashboard/security", label: "Security", icon: ShieldCheck, lordicon: "security" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, lordicon: "settings" },
];
const operationsLinks: NavigationLink[] = [
  { href: "/dashboard/system", label: "System health", icon: ShieldCheck, lordicon: "system" },
  { href: "/dashboard/deployment", label: "Deployment", icon: Rocket, lordicon: "deployment" },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench, lordicon: "maintenance" },
  { href: "/dashboard/quality", label: "Quality assurance", icon: FlaskConical, lordicon: "quality" },
  { href: "/dashboard/handoff", label: "Release handoff", icon: BadgeCheck, lordicon: "handoff" },
];

type SidebarProps = {
  mobile?: boolean; onNavigate?: () => void; quickModule?: WorkspaceDefaultModule;
  collapsed?: boolean; onToggleCollapse?: () => void;
};

export function Sidebar({ mobile = false, onNavigate, quickModule = "files", collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isCompact = collapsed && !mobile;
  const operationsActive = operationsLinks.some(({ href }) => pathname.startsWith(href));
  const quickAction = pathname.startsWith("/dashboard/notes")
    ? { href: "/dashboard/notes?new=1", label: "New note", icon: StickyNote }
    : pathname.startsWith("/dashboard/videos") || (pathname === "/dashboard" && quickModule === "videos")
      ? { href: "/dashboard/videos", label: "Open video library", icon: Video }
      : pathname.startsWith("/dashboard/assignments") || (pathname === "/dashboard" && quickModule === "assignments")
        ? { href: "/dashboard/assignments", label: "Open assignments", icon: ClipboardList }
        : { href: "/dashboard/files?command=upload", label: "Upload files", icon: Upload };
  const QuickIcon = quickAction.icon;
  const groupProps = { pathname, collapsed: isCompact, onNavigate, targetPrefix: mobile ? "mobile-sidebar" : "desktop-sidebar", reduceMotion: Boolean(reduceMotion) };

  return (
    <aside className={`archive-sidebar ${mobile ? "is-mobile" : "is-desktop"} ${isCompact ? "is-collapsed" : ""}`} aria-label="Primary navigation">
      <div className="archive-sidebar-heading">
        <div className="archive-sidebar-copy archive-sidebar-heading-copy" aria-hidden={isCompact}><span>YOUR WORKSPACE</span><strong>{mobile ? "Damon's Archive" : "Make room for ideas."}</strong></div>
        <button type="button" data-no-glass data-autofocus={mobile || undefined} className="archive-sidebar-toggle" onClick={mobile ? onNavigate : onToggleCollapse} title={mobile ? "Close navigation" : isCompact ? "Expand sidebar" : "Collapse sidebar"} aria-label={mobile ? "Close navigation" : isCompact ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={mobile ? undefined : !isCompact}>
          {mobile ? <X size={18} /> : isCompact ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <Link data-no-glass href={quickAction.href} onClick={onNavigate} className="archive-sidebar-create" title={isCompact ? quickAction.label : undefined} aria-label={quickAction.label}><span className="archive-sidebar-create-icon"><QuickIcon size={18} aria-hidden="true" /></span><span className="archive-sidebar-copy" aria-hidden={isCompact}>{quickAction.label}</span></Link>
      <nav className="archive-sidebar-scroll" aria-label="Dashboard navigation">
        <NavigationGroup label="Workspace" links={workspaceLinks} {...groupProps} />
        <NavigationGroup label="Organize" links={organizeLinks} {...groupProps} />
        <NavigationGroup label="Workspace settings" links={accountLinks} {...groupProps} />
        <OperationsNavigation key={operationsActive ? "operations-active" : "operations-idle"} initiallyOpen={operationsActive} {...groupProps} />
      </nav>
      <div className="archive-sidebar-footer">
        <div className="archive-sidebar-footer-main"><span className="archive-sidebar-footer-icon" title="Private workspace"><ShieldCheck size={18} aria-hidden="true" /></span><div className="archive-sidebar-copy" aria-hidden={isCompact}><strong>Private workspace</strong><span>Your archive. Your space.</span></div></div>
        <a href="https://lordicon.com/icons/?utm_source=damons_archive&utm_medium=referral" target="_blank" rel="noreferrer" className="archive-icon-credit" tabIndex={isCompact ? -1 : undefined} aria-hidden={isCompact}>Icons by Lordicon</a>
      </div>
    </aside>
  );
}

type NavigationGroupProps = { label: string; links: NavigationLink[]; pathname: string; collapsed: boolean; onNavigate?: () => void; targetPrefix: string; hideLabel?: boolean; reduceMotion: boolean };

function NavigationGroup({ label, links, pathname, collapsed, onNavigate, targetPrefix, hideLabel = false, reduceMotion }: NavigationGroupProps) {
  return <div className="archive-nav-group">{!hideLabel ? <p className="archive-nav-group-label" aria-hidden={collapsed}>{label}</p> : null}<div className="archive-nav-links">{links.map(({ href, label: linkLabel, lordicon, exact }) => {
    const active = isActivePath(pathname, href, exact);
    const targetId = `${targetPrefix}-${href.replace(/[^a-z0-9]+/gi, "-")}`;
    return <Link key={href} id={targetId} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={collapsed ? linkLabel : undefined} aria-label={linkLabel} className={`archive-nav-link ${active ? "is-active" : ""}`}>
      {active ? <motion.span className="archive-nav-highlight" initial={{ opacity: reduceMotion ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} aria-hidden="true" /> : null}
      <span className="archive-nav-icon"><LordIcon name={lordicon} size={19} active={active} targetId={targetId} /></span>
      <span className="archive-sidebar-copy archive-nav-label" aria-hidden={collapsed}>{linkLabel}</span>
      {active ? <span className="archive-nav-active-dot" aria-hidden="true" /> : null}
    </Link>;
  })}</div></div>;
}

function OperationsNavigation({ initiallyOpen, ...props }: Omit<NavigationGroupProps, "label" | "links"> & { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const expanded = open || props.collapsed;
  const id = `${props.targetPrefix}-operations`;
  return <div className={`archive-operations ${expanded ? "is-open" : ""}`}>
    <button type="button" data-no-glass className="archive-operations-toggle" onClick={() => setOpen(!open)} aria-expanded={expanded} aria-controls={id} tabIndex={props.collapsed ? -1 : undefined} aria-hidden={props.collapsed}><span>Operations</span><ChevronDown size={14} aria-hidden="true" /></button>
    <div id={id} className="archive-operations-content" inert={!expanded} aria-hidden={!expanded}><div><NavigationGroup label="Operations" hideLabel links={operationsLinks} {...props} /></div></div>
  </div>;
}

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (href === "/dashboard/files") return pathname.startsWith(href) && !pathname.startsWith("/dashboard/files/shares") && !pathname.startsWith("/dashboard/files/recent");
  if (href === "/dashboard/assignments") return pathname.startsWith(href) && !pathname.startsWith("/dashboard/assignments/productivity") && !pathname.startsWith("/dashboard/assignments/reminders");
  return exact ? pathname === href : pathname.startsWith(href);
}
