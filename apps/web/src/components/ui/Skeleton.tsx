interface SkeletonBlockProps {
  width?: string;
  height?: string;
  radius?: string;
}

export function SkeletonBlock({
  width = "100%",
  height = "16px",
  radius = "8px",
}: SkeletonBlockProps) {
  return (
    <span
      className="skeleton-block"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function PageSkeleton() {
  return (
    <div
      className="page-stack"
      aria-busy="true"
      aria-label="Carregando conteúdo…"
    >
      <div className="stack-compact">
        <SkeletonBlock width="240px" height="30px" />
        <SkeletonBlock width="380px" height="16px" />
      </div>
      <div className="card skeleton-stack">
        <SkeletonBlock width="55%" height="20px" />
        <SkeletonBlock width="100%" height="52px" radius="12px" />
        <SkeletonBlock width="100%" height="52px" radius="12px" />
        <SkeletonBlock width="80%" height="52px" radius="12px" />
      </div>
    </div>
  );
}
