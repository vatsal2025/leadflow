"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, FilePenLine, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import type { Status } from "@/lib/api";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <ArrowUpRight size={23} strokeWidth={2.7} />
      </span>
      <span>
        Lead<span className="brand-light">Flow</span>
        <span className="brand-dot">.</span>
      </span>
    </div>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`badge status-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <span className="status-dot" />
      {status}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: string;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  const content = useRef<HTMLDivElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={content}
          className={`dialog ${className}`}
          onPointerDownOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            const field = content.current?.querySelector<HTMLElement>(
              "input, select, textarea",
            );
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Close dialog"
              disabled={busy}
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p className="error-notice" role="alert">
      {children}
    </p>
  );
}

export function ConfirmDiscard({
  open,
  description,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  description: string;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay confirmation-overlay" />
        <Dialog.Content
          role="alertdialog"
          className="dialog confirmation-dialog"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current = document.activeElement as HTMLElement;
            cancel.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
        >
          <div className="confirmation-body">
            <span className="confirmation-icon" aria-hidden="true">
              <FilePenLine size={24} />
            </span>
            <Dialog.Title>Discard unsaved changes?</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </div>
          <div className="confirmation-actions">
            <button
              ref={cancel}
              type="button"
              className="button secondary"
              onClick={onCancel}
            >
              Keep editing
            </button>
            <button type="button" className="button danger" onClick={onDiscard}>
              Discard changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
