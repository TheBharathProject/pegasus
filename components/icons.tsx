import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const baseProps: Props = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true
};

function Svg({ children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg {...baseProps} {...rest}>
      {children}
    </svg>
  );
}

export function DashboardIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function BriefcaseIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </Svg>
  );
}

export function NotebookIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5z" />
      <path d="M9 4v18" />
      <path d="M13 9h3M13 13h3" />
    </Svg>
  );
}

export function UserIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </Svg>
  );
}

export function FileIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h6" />
    </Svg>
  );
}

export function FolderIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

export function SettingsIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  );
}

export function ChatIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function UserPlusIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
      <path d="M19 8v6M16 11h6" />
    </Svg>
  );
}

export function HelpIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function ContactIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M8 17c0-2 2-3 4-3s4 1 4 3" />
      <path d="M3 9h2M3 14h2M19 9h2M19 14h2" />
    </Svg>
  );
}

export function ChevronRight(props: Props) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function ChevronLeft(props: Props) {
  return (
    <Svg {...props}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function ChevronDown(props: Props) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function PlusIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function MinusIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function SearchIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function PencilIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

export function TagIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CalendarIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M16 2.5v4" />
      <path d="M8 2.5v4" />
      <path d="M3 10.5h18" />
    </Svg>
  );
}

// Counter-clockwise arrow over a clock — universal "history" mark.
// Used in the /settings Billing card header to toggle the activity panel.
export function HistoryIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function BellIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </Svg>
  );
}

export function EyeIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function PinIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 2v6" />
      <path d="m9 9 3-3 3 3-2 2v6l-2 2-2-2v-6z" />
    </Svg>
  );
}

export function TrashIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </Svg>
  );
}

export function DownloadIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  );
}

export function UploadIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 20V8" />
      <path d="m7 13 5-5 5 5" />
      <path d="M5 3h14" />
    </Svg>
  );
}

export function ImportIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <rect x="3" y="17" width="18" height="4" rx="1" />
    </Svg>
  );
}

export function ListIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </Svg>
  );
}

export function BoardIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="6" height="18" rx="1" />
      <rect x="11" y="3" width="6" height="12" rx="1" />
      <rect x="19" y="3" width="2" height="6" rx="1" />
    </Svg>
  );
}

export function SunIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
    </Svg>
  );
}

export function MoonIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Svg>
  );
}

export function MonitorIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}

export function ArrowRightIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </Svg>
  );
}

export function ArrowUpRightIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </Svg>
  );
}

export function CloseIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function BookOpenIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M22 5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v15" />
      <path d="M2 5v14h8M22 5v14h-8" />
    </Svg>
  );
}

export function GaugeIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 14a3 3 0 1 0 3-3" />
      <path d="M3 12a9 9 0 0 1 18 0" />
      <path d="M3 12v3M21 12v3" />
    </Svg>
  );
}

export function BellOffIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8.7 3.7A6 6 0 0 1 18 9v3" />
      <path d="M6 9c0 6-3 7-3 7h14" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="M3 3l18 18" />
    </Svg>
  );
}

export function ShieldCheckIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function SparkleIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </Svg>
  );
}

export function SparkleStarIcon(props: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 1c0 4.5 1.2 7.3 2.9 9.1C16.7 11.8 19.5 13 24 13c-4.5 0-7.3 1.2-9.1 2.9-1.7 1.8-2.9 4.6-2.9 9.1 0-4.5-1.2-7.3-2.9-9.1C7.3 14.2 4.5 13 0 13c4.5 0 7.3-1.2 9.1-2.9C10.8 8.3 12 5.5 12 1Z" />
    </svg>
  );
}

export function MailIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4" y="7" width="16" height="11" rx="1.5" />
      <path d="M4.5 8.2 12 13.2l7.5-5" />
    </Svg>
  );
}

export function WandIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 20 11 10" />
      <path d="M16 5 17.5 8.5 21 10 17.5 11.5 16 15 14.5 11.5 11 10 14.5 8.5Z" />
    </Svg>
  );
}

export function GraduationIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M22 10 12 4 2 10l10 6 10-6Z" />
      <path d="M6 12v5c2 1 4 2 6 2s4-1 6-2v-5" />
    </Svg>
  );
}

export function CodeIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </Svg>
  );
}

export function UndoIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 7v6h6" />
      <path d="M21 17a8 8 0 0 0-8-8H3" />
    </Svg>
  );
}

export function RedoIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M21 7v6h-6" />
      <path d="M3 17a8 8 0 0 1 8-8h10" />
    </Svg>
  );
}

export function SplitIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </Svg>
  );
}

export function MenuIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </Svg>
  );
}

export function GlobeIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
    </Svg>
  );
}
