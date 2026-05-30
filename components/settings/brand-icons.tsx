type BrandIconProps = {
  className?: string;
};

export function GoogleIcon({ className = "h-5 w-5" }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.3-4.5 3.3-7.7Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.9l-3.4-2.6c-.9.6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.7H2.1v2.7C3.9 20.4 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.6 13.8c-.2-.6-.4-1.2-.4-1.8s.1-1.2.4-1.8V7.5H2.1A11 11 0 0 0 1 12c0 1.6.4 3.1 1.1 4.5l3.5-2.7Z" />
      <path fill="#EA4335" d="M12 5.5c1.6 0 3.1.6 4.2 1.7l3.1-3.1A10.4 10.4 0 0 0 12 1C7.7 1 3.9 3.6 2.1 7.5l3.5 2.7c.9-2.7 3.4-4.7 6.4-4.7Z" />
    </svg>
  );
}

export function SlackIcon({ className = "h-5 w-5" }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#36C5F0" d="M8.2 2a2.2 2.2 0 0 1 2.2 2.2v5.1H8.2A2.2 2.2 0 0 1 6 7.1V4.2A2.2 2.2 0 0 1 8.2 2Z" />
      <path fill="#2EB67D" d="M22 8.2a2.2 2.2 0 0 1-2.2 2.2h-5.1V8.2A2.2 2.2 0 0 1 16.9 6h2.9A2.2 2.2 0 0 1 22 8.2Z" />
      <path fill="#ECB22E" d="M15.8 22a2.2 2.2 0 0 1-2.2-2.2v-5.1h2.2a2.2 2.2 0 0 1 2.2 2.2v2.9a2.2 2.2 0 0 1-2.2 2.2Z" />
      <path fill="#E01E5A" d="M2 15.8a2.2 2.2 0 0 1 2.2-2.2h5.1v2.2A2.2 2.2 0 0 1 7.1 18H4.2A2.2 2.2 0 0 1 2 15.8Z" />
      <path fill="#36C5F0" d="M2 8.2A2.2 2.2 0 0 1 4.2 6h2.2v2.2a2.2 2.2 0 1 1-4.4 0Z" />
      <path fill="#2EB67D" d="M15.8 2A2.2 2.2 0 0 1 18 4.2v2.2h-2.2a2.2 2.2 0 1 1 0-4.4Z" />
      <path fill="#ECB22E" d="M22 15.8a2.2 2.2 0 0 1-2.2 2.2h-2.2v-2.2a2.2 2.2 0 1 1 4.4 0Z" />
      <path fill="#E01E5A" d="M8.2 22A2.2 2.2 0 0 1 6 19.8v-2.2h2.2a2.2 2.2 0 1 1 0 4.4Z" />
    </svg>
  );
}

export function NotionIcon({ className = "h-5 w-5" }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#fff" stroke="#111" strokeWidth="1.5" d="M4 3.5 16.8 2.6 20 5.1v14.5l-12.7.8L4 17.8V3.5Z" />
      <path fill="#111" d="M8 8h2.3l4.4 6.7V8.8l-1.5-.2V8h4.4v.6l-1.4.2v8h-1.7L9.5 9.3v6.8l1.7.3v.6H6.5v-.6l1.5-.3V8.8l-1.5-.2V8H8Z" />
    </svg>
  );
}

export function StripeIcon({ className = "h-5 w-5" }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#635BFF" />
      <path fill="#fff" d="M13 10.2c-1.7-.6-2.1-.9-2.1-1.4 0-.5.4-.8 1.3-.8 1.1 0 2.2.4 3 .8V6.2a7.3 7.3 0 0 0-3-.6c-2.6 0-4.3 1.4-4.3 3.5 0 2.2 1.5 3 3.8 3.8 1.5.5 2 .8 2 1.4 0 .6-.5.9-1.5.9-1.2 0-2.6-.5-3.7-1.2v2.7c.9.5 2.1.9 3.8.9 2.7 0 4.5-1.3 4.5-3.6 0-2-1.2-2.9-3.8-3.8Z" />
    </svg>
  );
}

export function VercelIcon({ className = "h-5 w-5" }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#000" d="m12 3 10 18H2L12 3Z" />
    </svg>
  );
}
