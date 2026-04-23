"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { TextInputModal } from "@/components/ui/text-input-modal";

interface HeaderActionsMenuProps {
  entityLabel: string;
  entityType: "template" | "instance";
  onRename: (nextLabel: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onDeletedHref?: string;
  deleteDescription?: ReactNode;
  requireDeleteLabelMatch?: boolean;
}

export function HeaderActionsMenu({
  entityLabel,
  entityType,
  onRename,
  onDelete,
  onDeletedHref = "/",
  deleteDescription,
  requireDeleteLabelMatch = false,
}: HeaderActionsMenuProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const entityName = entityType === "template" ? "workflow template" : "workflow instance";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-label={`Open ${entityName} actions`}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border border-border bg-bg-2 text-t2 transition hover:border-border-hi hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:border-accent aria-expanded:bg-primary-bg aria-expanded:text-accent"
        >
          <Ellipsis className="h-[15px] w-[15px]" strokeWidth={2.4} />
        </button>
        {open ? (
          <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[168px] rounded-xl border border-border-hi bg-bg-2 p-1.5 shadow-[var(--shadow-canvas)]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setRenameOpen(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-t1 transition hover:bg-bg-3"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDeleteOpen(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-[#f87171] transition hover:bg-linear-to-b hover:from-[#ef4444] hover:to-[#dc2626] hover:text-[#fff7f7]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {renameOpen ? (
        <TextInputModal
          title={`Rename ${entityName}`}
          description={`Choose a new name for this ${entityName}.`}
          label="Name"
          initialValue={entityLabel}
          submitLabel="Save"
          onClose={() => {
            if (!pending) setRenameOpen(false);
          }}
          onSubmit={async (nextLabel) => {
            setPending(true);
            try {
              await onRename(nextLabel);
              setRenameOpen(false);
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      {deleteOpen && requireDeleteLabelMatch ? (
        <TextInputModal
          title={`Delete "${entityLabel}"?`}
          description={
            deleteDescription ??
            `Type "${entityLabel}" to confirm deleting this ${entityName}.`
          }
          label={`Type "${entityLabel}" to confirm`}
          initialValue=""
          submitLabel="Delete"
          isValid={(value) => value.trim() === entityLabel}
          onClose={() => {
            if (!pending) setDeleteOpen(false);
          }}
          onSubmit={async (value) => {
            setPending(true);
            try {
              await onDelete();
              setDeleteOpen(false);
              router.push(onDeletedHref);
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      {deleteOpen && !requireDeleteLabelMatch ? (
        <ConfirmModal
          title={`Delete "${entityLabel}"?`}
          description={
            deleteDescription ?? `This ${entityName} will be permanently removed.`
          }
          confirmLabel="Delete"
          onCancel={() => {
            if (!pending) setDeleteOpen(false);
          }}
          onConfirm={async () => {
            setPending(true);
            try {
              await onDelete();
              setDeleteOpen(false);
              router.push(onDeletedHref);
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
