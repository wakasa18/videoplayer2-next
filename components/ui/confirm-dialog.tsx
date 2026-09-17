"use client";

import { useSyncExternalStore } from "react";
import { Button } from "./button";
import { X, AlertCircle } from "./icons";
import { ModalPortal } from "./modal-portal";

type Options = { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type Request = Options & { id: number; message: string; notice: boolean; resolve: (answer: boolean) => void };
const queue: Request[] = [];
const listeners = new Set<() => void>();
let sequence = 0;
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => queue[0] ?? null;
const serverSnapshot = () => null;

/** App-owned confirmation, with the same focus and stacking behavior as other dialogs. */
export function confirmAction(message: string, options: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ ...options, id: ++sequence, message, notice: false, resolve });
    emit();
  });
}

export function showNotice(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ id: ++sequence, message, notice: true, resolve });
    emit();
  });
}

export function ConfirmDialogHost() {
  const request = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!request) return null;
  const destructive = request.destructive ?? /^(?:permanently delete|delete|clear|revoke|roll back)/i.test(request.message);
  const finish = (answer: boolean) => {
    if (queue[0] !== request) return;
    queue.shift();
    emit();
    request.resolve(answer);
  };
  return <ModalPortal>
    <div className="tech-modal-overlay fixed inset-0 z-[160] grid place-items-center p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(false); }}>
      <section key={request.id} className="tech-modal-surface w-full max-w-md p-5 sm:p-6" role="alertdialog" aria-labelledby={`confirmation-${request.id}`} aria-describedby={`confirmation-message-${request.id}`}>
        <header className="flex items-start gap-3">
          <AlertCircle className={`mt-1 size-5 shrink-0 ${destructive ? "text-red-300" : "text-primary"}`} />
          <h2 id={`confirmation-${request.id}`} className="min-w-0 flex-1 text-lg font-semibold">{request.title ?? (request.notice ? "Workspace notice" : destructive ? "Confirm action" : "Before you continue")}</h2>
          <button type="button" aria-label="Close confirmation" onClick={() => finish(false)} className="grid size-10 place-items-center"><X className="size-4" /></button>
        </header>
        <p id={`confirmation-message-${request.id}`} className="mt-4 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{request.message}</p>
        <footer className="mt-6 flex flex-wrap justify-end gap-2">
          {!request.notice ? <Button variant="outline" data-autofocus onClick={() => finish(false)}>{request.cancelLabel ?? "Cancel"}</Button> : null}
          <Button variant={destructive ? "destructive" : "default"} data-autofocus={request.notice || undefined} onClick={() => finish(true)}>{request.confirmLabel ?? (request.notice ? "Got it" : destructive ? "Confirm" : "Continue")}</Button>
        </footer>
      </section>
    </div>
  </ModalPortal>;
}
