"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { IconButtonTooltip } from "@/components/ui/icon-button-tooltip";
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const entityName = entityType === "template" ? "workflow template" : "workflow instance";

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-2 p-0.5">
        <IconButtonTooltip
          type="button"
          tooltip={`Rename ${entityName}`}
          onClick={() => setRenameOpen(true)}
          align="end"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
        </IconButtonTooltip>
        <span aria-hidden className="h-4 w-px bg-border" />
        <IconButtonTooltip
          type="button"
          tooltip={`Delete ${entityName}`}
          onClick={() => setDeleteOpen(true)}
          align="end"
          className="text-[#f87171] hover:bg-linear-to-b hover:from-[#ef4444] hover:to-[#dc2626] hover:text-[#fff7f7]"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
        </IconButtonTooltip>
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
          onSubmit={async () => {
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
