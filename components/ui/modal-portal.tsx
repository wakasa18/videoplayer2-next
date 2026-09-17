"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => undefined;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

let modalLockCount = 0;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";
let modalTitleSequence = 0;
const modalStack: HTMLElement[] = [];
const backgroundInert = new Map<HTMLElement, boolean>();

function syncModalStack() {
  const top = modalStack.at(-1);
  modalStack.forEach((root, index) => {
    root.style.zIndex = String(150 + index * 2);
    root.inert = root !== top;
  });
  if (top) {
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child.hasAttribute("data-tech-modal-portal") || child.matches("script, style, [data-radix-popper-content-wrapper]")) continue;
      if (!backgroundInert.has(child)) backgroundInert.set(child, child.inert);
      child.inert = true;
    }
  } else {
    backgroundInert.forEach((inert, element) => { element.inert = inert; });
    backgroundInert.clear();
  }
}

function canFocus(element: HTMLElement) {
  return element.tabIndex >= 0 && !element.closest("[hidden], [inert], [aria-hidden='true']") && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

function lockDocumentScroll() {
  if (modalLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    document.body.classList.add("tech-modal-open");
  }
  modalLockCount += 1;
}

function unlockDocumentScroll() {
  modalLockCount = Math.max(0, modalLockCount - 1);
  if (modalLockCount !== 0) return;

  document.body.style.overflow = previousBodyOverflow;
  document.body.style.paddingRight = previousBodyPaddingRight;
  document.body.classList.remove("tech-modal-open");
}

function isTopmostPortal(root: HTMLElement) {
  return modalStack.at(-1) === root;
}

/**
 * Renders modal layers directly under <body> so viewport-fixed overlays are
 * never trapped by transformed/animated cards, page transitions, or filters.
 *
 * Active dialog content is detected automatically so portals can stay mounted
 * around AnimatePresence without locking the page while their dialog is closed.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let active = false;
    let surface: HTMLElement | null = null;
    let previousActive: HTMLElement | null = null;
    let addedRole = false;
    let addedAriaModal = false;
    let addedTabIndex = false;
    let addedAriaLabelledBy = false;
    let generatedHeading: HTMLElement | null = null;
    let focusFrame = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!active || !isTopmostPortal(root)) return;
      // Radix menus opened from a dialog handle their own Escape/Tab first.
      if (event.target instanceof Element && !root.contains(event.target) && event.target.closest("[role='menu'], [role='listbox']")) return;

      if (event.key === "Escape") {
        const closeButton = root.querySelector<HTMLButtonElement>(
          'button[aria-label*="close" i]:not([disabled])',
        );
        if (closeButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeButton.click();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(surface?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(canFocus);

      if (focusable.length === 0) {
        event.preventDefault();
        surface?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === surface || !surface?.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !surface?.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    const deactivate = () => {
      if (!active) return;
      active = false;
      const wasTopmost = isTopmostPortal(root);
      const stackIndex = modalStack.indexOf(root);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      root.inert = false;
      root.style.removeProperty("z-index");
      syncModalStack();
      root.removeAttribute("data-modal-active");
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);

      if (surface) {
        if (addedRole) surface.removeAttribute("role");
        if (addedAriaModal) surface.removeAttribute("aria-modal");
        if (addedTabIndex) surface.removeAttribute("tabindex");
        if (addedAriaLabelledBy) surface.removeAttribute("aria-labelledby");
      }
      if (generatedHeading?.dataset.techModalGeneratedId === "true") {
        generatedHeading.removeAttribute("id");
        delete generatedHeading.dataset.techModalGeneratedId;
      }

      unlockDocumentScroll();

      const restoreTarget = previousActive;
      surface = null;
      previousActive = null;
      addedRole = false;
      addedAriaModal = false;
      addedTabIndex = false;
      addedAriaLabelledBy = false;
      generatedHeading = null;

      if (wasTopmost && restoreTarget?.isConnected) {
        window.requestAnimationFrame(() => {
          if (!restoreTarget.closest("[inert]")) restoreTarget.focus({ preventScroll: true });
        });
      }
    };

    const focusDialog = () => {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(() => {
        if (!active || !isTopmostPortal(root)) return;
        const preferred = Array.from(surface?.querySelectorAll<HTMLElement>("[data-autofocus], [data-floating-panel-autofocus], [autofocus]") ?? []).find(canFocus)
          ?? Array.from(surface?.querySelectorAll<HTMLElement>("input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled])") ?? []).find(canFocus)
          ?? Array.from(surface?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).find(canFocus);
        (preferred ?? surface)?.focus({ preventScroll: true });
      });
    };

    const activate = () => {
      if (active) return;
      const nextSurface = root.querySelector<HTMLElement>(".tech-modal-surface, [data-floating-modal-surface]");
      if (!nextSurface) return;

      active = true;
      root.setAttribute("data-modal-active", "true");
      surface = nextSurface;
      previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modalStack.push(root);
      syncModalStack();
      addedRole = !surface.hasAttribute("role");
      addedAriaModal = !surface.hasAttribute("aria-modal");
      addedTabIndex = !surface.hasAttribute("tabindex");

      if (addedRole) surface.setAttribute("role", "dialog");
      if (addedAriaModal) surface.setAttribute("aria-modal", "true");
      if (addedTabIndex) surface.setAttribute("tabindex", "-1");

      if (!surface.hasAttribute("aria-label") && !surface.hasAttribute("aria-labelledby")) {
        const heading = surface.querySelector<HTMLElement>("h1, h2, h3");
        if (heading) {
          if (!heading.id) {
            modalTitleSequence += 1;
            heading.id = `tech-modal-title-${modalTitleSequence}`;
            heading.dataset.techModalGeneratedId = "true";
            generatedHeading = heading;
          }
          surface.setAttribute("aria-labelledby", heading.id);
          addedAriaLabelledBy = true;
        }
      }

      lockDocumentScroll();
      document.addEventListener("keydown", handleKeyDown, true);

      focusDialog();
    };

    const sync = () => {
      const hasDialog = Boolean(root.querySelector(".tech-modal-overlay .tech-modal-surface, [data-floating-modal-surface]"));
      if (active && surface && !root.contains(surface)) deactivate();
      if (hasDialog) activate();
      else deactivate();
      // Loading can disable or replace the focused field after opening.
      if (active && document.activeElement === document.body) focusDialog();
    };

    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
    sync();

    return () => {
      observer.disconnect();
      deactivate();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div ref={rootRef} data-tech-modal-portal="" style={{ position: "relative" }}>
      {children}
    </div>,
    document.body,
  );
}
