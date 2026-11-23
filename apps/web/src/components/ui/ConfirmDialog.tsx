import { useEffect, useId, useRef } from "react";
import { IconAlert } from "../Icons";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="af-dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) {
          onCancel();
        }
      }}
    >
      <div className="af-dialog-body">
        <div className="af-dialog-header">
          <span className="af-dialog-icon" aria-hidden="true">
            <IconAlert size={20} />
          </span>
          <div>
            <h2 id={titleId} className="af-dialog-title">
              {title}
            </h2>
            <p id={descId} className="af-dialog-desc">
              {description}
            </p>
          </div>
        </div>

        <div className="af-dialog-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger-solid btn-sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Processando…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
