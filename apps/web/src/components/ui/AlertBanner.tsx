import type { ReactNode } from "react";
import { IconAlert } from "../Icons";

interface AlertBannerProps {
  tone?: "error" | "warning";
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
}

export function AlertBanner({
  tone = "error",
  children,
  actionLabel,
  onAction,
  actionIcon,
}: AlertBannerProps) {
  return (
    <div
      className={`alert alert-${tone} ${actionLabel ? "error-row" : ""}`}
      role="alert"
    >
      <span className="error-row-body">
        <IconAlert size={16} className="alert-icon" />
        <span>{children}</span>
      </span>
      {actionLabel && onAction && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAction}
        >
          {actionIcon}
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
