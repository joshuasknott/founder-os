"use client";

import {
  siGithub,
  siGmail,
  siGooglecalendar,
  siGoogledocs,
  siGoogledrive,
  siGooglesheets,
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
  vercel: siVercel,
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
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" role="img">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-13Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M7.25 8.5h9.5v1.75h-9.5V8.5Zm0 3.15h6.25v1.75H7.25v-1.75Zm0 3.15h4.5v1.75h-4.5V14.8Z" fill="currentColor" />
      <path d="M16 13.5h1.75v3H20v1.75h-4V13.5Z" fill="currentColor" />
    </svg>
  );
}

export function ConnectorBrandIcon({ id, className = "h-6 w-6" }: ConnectorBrandIconProps) {
  if (id === "opencode") return <OpenCodeIcon className={className} />;

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
