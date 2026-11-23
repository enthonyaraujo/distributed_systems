import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function baseProps(size: number, props: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };
}

/**
 * Marca geométrica autoral do AcadFlow: camadas acadêmicas em fluxo contínuo.
 */
export function AcadFlowMark({ size = 32, ...props }: IconProps) {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="4"
          y1="2"
          x2="32"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--af-primary, #0a24e9)" />
          <stop offset="100%" stopColor="var(--af-primary-deep, #152eae)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill={`url(#${gradId})`} />
      <path
        d="M18 8.5L26.5 13.25L18 18L9.5 13.25L18 8.5Z"
        fill="var(--af-on-primary, #ffffff)"
        fillOpacity="0.96"
      />
      <path
        d="M9.5 18.2L18 22.95L26.5 18.2"
        stroke="var(--af-on-primary, #ffffff)"
        strokeOpacity="0.88"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 23.4L18 27.05L24.5 23.4"
        stroke="var(--af-primary-tint-ink, #9db0ff)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDashboard({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
    </svg>
  );
}

export function IconTasks({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8.5 12.2L10.8 14.5L15.8 9.5" />
    </svg>
  );
}

export function IconPages({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5L14 3.5Z" />
      <path d="M14 3.5V8.5H19" />
      <path d="M9 12.5H15" />
      <path d="M9 16H13" />
    </svg>
  );
}

export function IconPlus({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  );
}

export function IconSearch({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <circle cx="11" cy="11" r="6.8" />
      <path d="M16.2 16.2L20.5 20.5" />
    </svg>
  );
}

export function IconPanelCollapse({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4V20" />
      <path d="M15.5 9.5L13 12L15.5 14.5" />
    </svg>
  );
}

export function IconPanelExpand({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4V20" />
      <path d="M13.5 9.5L16 12L13.5 14.5" />
    </svg>
  );
}

export function IconMenu({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M4 7H20" />
      <path d="M4 12H20" />
      <path d="M4 17H20" />
    </svg>
  );
}

export function IconClose({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M6 6L18 18" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export function IconLogout({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M10 4H6A2 2 0 0 0 4 6V18A2 2 0 0 0 6 20H10" />
      <path d="M15 8L19 12L15 16" />
      <path d="M19 12H9" />
    </svg>
  );
}

export function IconRefresh({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M20 12A8 8 0 1 1 17.65 6.35L20 8.5" />
      <path d="M20 4V8.5H15.5" />
    </svg>
  );
}

export function IconClock({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12L15 13.8" />
    </svg>
  );
}

export function IconActivity({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M3 12H7L10 5L14 19L17 12H21" />
    </svg>
  );
}

export function IconCheckCircle({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2L10.9 14.6L15.6 9.8" />
    </svg>
  );
}

export function IconCheck({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M5 12.5L9.5 17L19 7.5" />
    </svg>
  );
}

export function IconCalendar({ size = 14, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3V6.5" />
      <path d="M16 3V6.5" />
      <path d="M3.5 9.5H20.5" />
    </svg>
  );
}

export function IconEdit({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M12 20H20" />
      <path d="M16.5 3.8A2.1 2.1 0 0 1 19.5 6.8L8.5 17.8L4.5 19L5.7 15L16.5 3.8Z" />
    </svg>
  );
}

export function IconTrash({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M4 7H20" />
      <path d="M9.5 4H14.5" />
      <path d="M6.5 7L7.3 18.5A2 2 0 0 0 9.3 20.3H14.7A2 2 0 0 0 16.7 18.5L17.5 7" />
    </svg>
  );
}

export function IconSave({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M5 4H16.5L20 7.5V19A1.5 1.5 0 0 1 18.5 20.5H5.5A1.5 1.5 0 0 1 4 19V5.5A1.5 1.5 0 0 1 5.5 4Z" />
      <path d="M8 4V9H15V4" />
      <rect x="8" y="13.5" width="8" height="7" rx="1" />
    </svg>
  );
}

export function IconChevronRight({ size = 14, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M9 6L15 12L9 18" />
    </svg>
  );
}

export function IconShieldLock({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M12 3L19 6V11.5C19 16 16 19.6 12 21C8 19.6 5 16 5 11.5V6L12 3Z" />
      <path d="M9.5 12.2L11.2 14L15 10.2" />
    </svg>
  );
}

export function IconAlert({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8V12.5" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconWifiOff({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M3 3L21 21" />
      <path d="M8.5 16.5A5 5 0 0 1 15.5 16.5" />
      <path d="M5 12.8A10 10 0 0 1 10.2 10.3" />
      <path d="M14.8 10.6A10 10 0 0 1 19 12.8" />
      <circle cx="12" cy="19.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconListBullet({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M9 6H20" />
      <path d="M9 12H20" />
      <path d="M9 18H20" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconListOrdered({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M10 6H20" />
      <path d="M10 12H20" />
      <path d="M10 18H20" />
      <path d="M4.5 5H5.8V8.5" />
      <path d="M4 11.2C4 10.5 4.5 10 5.3 10C6 10 6.5 10.4 6.5 11C6.5 11.7 5.7 12.2 4 13.5H6.6" />
      <path d="M4.2 16.5H6.2L5.1 17.8C5.9 17.8 6.5 18.2 6.5 18.9C6.5 19.6 5.9 20 5 20C4.4 20 4 19.8 3.8 19.5" />
    </svg>
  );
}

export function IconChecklist({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M4 7.5L5.6 9L8.5 6" />
      <path d="M11.5 7.5H20" />
      <path d="M4 16.5L5.6 18L8.5 15" />
      <path d="M11.5 16.5H20" />
    </svg>
  );
}

export function IconQuote({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M10 8H6.5A2.5 2.5 0 0 0 4 10.5V13A2 2 0 0 0 6 15H8.5A1.5 1.5 0 0 1 10 16.5V17A2 2 0 0 1 8 19H5.5" />
      <path d="M20 8H16.5A2.5 2.5 0 0 0 14 10.5V13A2 2 0 0 0 16 15H18.5A1.5 1.5 0 0 1 20 16.5V17A2 2 0 0 1 18 19H15.5" />
    </svg>
  );
}

export function IconUndo({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M9 7L4 12L9 17" />
      <path d="M4 12H15A5 5 0 0 1 20 17V18" />
    </svg>
  );
}

export function IconRedo({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M15 7L20 12L15 17" />
      <path d="M20 12H9A5 5 0 0 0 4 17V18" />
    </svg>
  );
}
