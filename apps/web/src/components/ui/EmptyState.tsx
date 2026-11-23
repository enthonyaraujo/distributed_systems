import type { ReactNode } from "react";

interface EmptyStateProps {
  variant?: "card" | "inline";
  icon?: ReactNode;
  title?: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  variant = "card",
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  if (variant === "inline") {
    return (
      <div className="empty-inline">
        <p className="muted">{description}</p>
        {action}
      </div>
    );
  }

  return (
    <section className="card empty-state" aria-live="polite">
      {icon && (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <h3>{title}</h3>}
      <p className="muted">{description}</p>
      {action && <div className="empty-state-actions">{action}</div>}
    </section>
  );
}
