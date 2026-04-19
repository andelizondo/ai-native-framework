"use client";

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-[380px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div
          id="confirm-modal-title"
          className="text-[16px] font-bold tracking-tight text-[#ef4444]"
        >
          {title}
        </div>
        <div className="mb-6 mt-1 text-[12.5px] leading-[1.6] text-t3">
          {description}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-bg-3 px-4 py-2 text-[13px] font-medium text-t2 transition hover:bg-bg-4 hover:text-t1"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[#ef4444] px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
