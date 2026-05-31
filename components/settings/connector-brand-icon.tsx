"use client";

import {
  siGithub,
  siGmail,
  siGooglecalendar,
  siGoogledocs,
  siGoogledrive,
  siGooglesheets,
  siPosthog,
  siResend,
  siStripe,
  siVercel,
  type SimpleIcon,
} from "simple-icons";

type ConnectorBrandIconProps = {
  id: string;
  className?: string;
};

const brandIcons: Record<string, SimpleIcon> = {
  gmail: siGmail,
  google_calendar: siGooglecalendar,
  google_drive: siGoogledrive,
  google_docs: siGoogledocs,
  google_sheets: siGooglesheets,
  github: siGithub,
  stripe: siStripe,
  vercel: siVercel,
  posthog: siPosthog,
  resend: siResend,
};

function SimpleBrandIcon({ icon, className }: { icon: SimpleIcon; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" role="img">
      <path fill={`#${icon.hex}`} d={icon.path} />
    </svg>
  );
}

function OpenCodeIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 84 30" className={className} aria-hidden="true" role="img">
      <path d="M24 24H6V18H18V12H24V24ZM6 18H0V12H6V18Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M6 24H24V30H0V18H6V24ZM18 18H6V12H18V18ZM24 12H18V6H0V0H24V12Z" fill="currentColor" />
      <path d="M54 18V24H36V18H54Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M54 18H36V24H54V30H30V0H54V18ZM36 12H48V6H36V12Z" fill="currentColor" />
      <path d="M78 30H66V12H78V30Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M78 6H66V30H60V0H78V6ZM84 30H78V6H84V30Z" fill="currentColor" />
    </svg>
  );
}

function CanvaIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" role="img">
      <circle cx="12" cy="12" r="12" fill="#00C4CC" />
      <path
        fill="#fff"
        d="M15.8 8.1c-.7-.9-1.7-1.4-3-1.4-2.8 0-5.2 2.5-5.2 5.7 0 2.8 1.8 4.9 4.4 4.9 1.7 0 3.1-.8 4-2.2l-1.5-1c-.6.8-1.3 1.3-2.2 1.3-1.5 0-2.4-1.2-2.4-3 0-2.2 1.3-3.8 2.9-3.8.8 0 1.3.3 1.8 1l1.2-1.5Z"
      />
    </svg>
  );
}

export function ConnectorBrandIcon({ id, className = "h-6 w-6" }: ConnectorBrandIconProps) {
  if (id === "opencode") return <OpenCodeIcon className={className} />;
  if (id === "canva") return <CanvaIcon className={className} />;

  const icon = brandIcons[id];
  if (icon) return <SimpleBrandIcon icon={icon} className={className} />;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-500 ${className}`}
      aria-hidden="true"
    >
      {id.slice(0, 2).toUpperCase()}
    </span>
  );
}
