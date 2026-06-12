"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Code2,
  FileText,
  Github,
  Menu,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";
import { siGithub, siVercel, type SimpleIcon } from "simple-icons";

type ToolLogo = {
  name: string;
  icon?: SimpleIcon;
  iconNode?: React.ReactNode;
};

type TrustItem = {
  title: string;
  text: string;
  signal: string;
};

const githubUrl = "https://github.com/joshuasknott/founder-os";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#workflow" },
  { label: "Integrations", href: "#integrations" },
  { label: "Trust", href: "#trust" },
  { label: "Privacy", href: "/privacy" },
];

const toolLogos: ToolLogo[] = [
  { name: "Gmail", iconNode: <GmailLogo /> },
  { name: "Calendar", iconNode: <GoogleCalendarLogo /> },
  { name: "Drive", iconNode: <GoogleDriveLogo /> },
  { name: "Docs", iconNode: <GoogleDocsLogo /> },
  { name: "Sheets", iconNode: <GoogleSheetsLogo /> },
  { name: "GitHub", icon: siGithub },
  { name: "Vercel", icon: siVercel },
  { name: "Local build", iconNode: <Code2 size={18} /> },
];

const trustItems: TrustItem[] = [
  {
    title: "Open source",
    text: "Run FounderOS yourself, inspect the operating layer, and keep control of the setup.",
    signal: "Source",
  },
  {
    title: "Approval-first",
    text: "Sending, publishing, spending, deletion, and live changes stop for review.",
    signal: "Review",
  },
  {
    title: "Connected only when useful",
    text: "Google Workspace, GitHub, Vercel, and local build support appear around the work that needs them.",
    signal: "Context",
  },
  {
    title: "Managed when useful",
    text: "Hosted reliability and setup support are available when maintaining the runtime is not worth your time.",
    signal: "Hosted",
  },
];

const heroPrompt = "Review my launch plan, draft the update, and prepare the preview for approval.";

function SimpleBrandIcon({ icon, className = "h-5 w-5" }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" role="img">
      <path fill={`#${icon.hex}`} d={icon.path} />
    </svg>
  );
}

function GmailLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true" role="img">
      <path d="M4.5 6.5v11h3V9.86L12 13.2l4.5-3.34V17.5h3v-11l-7.5 5.55L4.5 6.5Z" fill="#EA4335" />
      <path d="M4.5 6.5 12 12.05l7.5-5.55-1.45-2L12 8.98 5.95 4.5l-1.45 2Z" fill="#C5221F" />
      <path d="M4.5 6.5v11h3V9.86L4.5 7.64V6.5Z" fill="#FBBC04" />
      <path d="M16.5 9.86v7.64h3v-11l-3 2.22Z" fill="#34A853" />
      <path d="M5.95 4.5 12 8.98l6.05-4.48A2.4 2.4 0 0 1 19.5 6.5L12 12.05 4.5 6.5A2.4 2.4 0 0 1 5.95 4.5Z" fill="#4285F4" opacity=".92" />
    </svg>
  );
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true" role="img">
      <path d="M5.2 3h13.6A2.2 2.2 0 0 1 21 5.2v13.6a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 18.8V5.2A2.2 2.2 0 0 1 5.2 3Z" fill="#fff" />
      <path d="M5.2 3H12v5.2H3v-3A2.2 2.2 0 0 1 5.2 3Z" fill="#1A73E8" />
      <path d="M12 3h6.8A2.2 2.2 0 0 1 21 5.2v3h-9V3Z" fill="#4285F4" />
      <path d="M3 8.2h5.2V21h-3A2.2 2.2 0 0 1 3 18.8V8.2Z" fill="#FBBC04" />
      <path d="M15.8 8.2H21v6.2h-5.2V8.2Z" fill="#EA4335" />
      <path d="M8.2 8.2h7.6V21H8.2V8.2Z" fill="#fff" />
      <path d="M15.8 14.4H21v4.4a2.2 2.2 0 0 1-2.2 2.2h-3v-6.6Z" fill="#34A853" />
      <path d="M8 13.05c.07-.67.34-1.19.82-1.57.48-.38 1.1-.57 1.88-.57.8 0 1.43.2 1.9.6.47.4.7.93.7 1.58 0 .72-.32 1.23-.95 1.54.78.27 1.17.86 1.17 1.77 0 .72-.26 1.31-.79 1.75-.52.44-1.21.66-2.06.66-.82 0-1.49-.2-2.01-.6-.52-.4-.8-.96-.84-1.67h1.58c.06.59.49.89 1.28.89.38 0 .68-.09.9-.28.22-.2.33-.46.33-.8 0-.35-.12-.62-.36-.8-.23-.18-.57-.27-1.02-.27h-.72V13.9h.7c.37 0 .66-.08.87-.24.21-.17.32-.41.32-.73 0-.57-.34-.86-1.02-.86-.65 0-1.02.33-1.09.98H8Zm6.44-1.98h2.35v7.6h-1.56v-5.78l-1.46.72-.55-1.19 1.22-.63v-.72Z" fill="#3c4043" />
    </svg>
  );
}

function GoogleDriveLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true" role="img">
      <path d="M8.3 3.5h7.4l5.8 10.05h-7.42L8.3 3.5Z" fill="#0F9D58" />
      <path d="M2.5 13.55 8.3 3.5l3.7 6.42-5.8 10.08-3.7-6.45Z" fill="#F4B400" />
      <path d="M6.2 20h11.6l3.7-6.45H9.9L6.2 20Z" fill="#4285F4" />
      <path d="M8.3 3.5 12 9.92h7.4L15.7 3.5H8.3Z" fill="#34A853" opacity=".9" />
    </svg>
  );
}

function GoogleDocsLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true" role="img">
      <path d="M6 3.5h8.4L19 8.1v12.4H6V3.5Z" fill="#4285F4" />
      <path d="M14.4 3.5v4.6H19l-4.6-4.6Z" fill="#AECBFA" />
      <path d="M8.8 11.2h6.4v1.25H8.8V11.2Zm0 2.55h6.4V15H8.8v-1.25Zm0 2.55h4.7v1.25H8.8V16.3Z" fill="#fff" />
    </svg>
  );
}

function GoogleSheetsLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true" role="img">
      <path d="M6 3.5h8.4L19 8.1v12.4H6V3.5Z" fill="#0F9D58" />
      <path d="M14.4 3.5v4.6H19l-4.6-4.6Z" fill="#87D8A4" />
      <path d="M8.7 11h6.6v6.6H8.7V11Zm1.15 1.15v1.45h1.95v-1.45H9.85Zm3.05 0v1.45h1.25v-1.45H12.9Zm-3.05 2.55v1.75h1.95V14.7H9.85Zm3.05 0v1.75h1.25V14.7H12.9Z" fill="#fff" />
    </svg>
  );
}

function LogoMark() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-zinc-950/10 bg-white shadow-sm">
      <Image src="/marketing/founderos-mark-generated.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
    </span>
  );
}

export default function MarketingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-zinc-950">
      <Navbar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <HeroSection />
      <WorkflowProofSection />
      <ToolStrip />
      <TrustSection />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Navbar({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-950/[0.06] bg-[#fbfaf7]/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/marketing" className="flex items-center gap-3" aria-label="FounderOS marketing home">
          <LogoMark />
          <span className="text-xl font-bold text-zinc-950">FounderOS</span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="text-sm font-medium text-zinc-700 transition hover:text-zinc-950">
              {item.label}
            </a>
          ))}
          <a href={githubUrl} className="text-sm font-medium text-zinc-700 transition hover:text-zinc-950">
            GitHub
          </a>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-white hover:text-zinc-950">
            Log in
          </Link>
          <Link href="/" className="rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800">
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-950/10 bg-white text-zinc-950 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-zinc-950/[0.06] bg-[#fbfaf7] px-5 py-5 lg:hidden">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-zinc-700"
              >
                {item.label}
              </a>
            ))}
            <Link href="/" className="rounded-lg border border-zinc-950/10 bg-white px-4 py-2 text-center text-sm font-semibold">
              Log in
            </Link>
            <Link href="/" className="rounded-lg bg-zinc-950 px-4 py-2 text-center text-sm font-semibold text-white">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section id="product" className="relative overflow-hidden border-b border-zinc-950/[0.06] bg-[#fbfaf7]">
      <div className="soft-grid pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 pb-10 pt-8 sm:px-8 sm:pb-14 lg:pt-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-950/[0.08] bg-white px-3 py-1 text-xs font-semibold text-zinc-500 shadow-sm">
            <Sparkles size={13} />
            Built for a non-technical founder running one business
          </p>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.02] text-zinc-950 sm:text-6xl">
            Ask, delegate, review, and reuse business context in one place.
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-pretty text-base leading-7 text-zinc-600 sm:text-lg">
            FounderOS connects your company knowledge, Google Workspace, GitHub, Vercel, local build setup, and approvals so work can move from request to review without exposing the machinery.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-6 text-sm font-semibold text-white shadow-lg shadow-zinc-950/10 transition hover:bg-zinc-800">
              Get started for free
              <ArrowRight size={16} />
            </Link>
            <a href={githubUrl} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-950/[0.1] bg-white px-6 text-sm font-semibold text-zinc-950 shadow-sm transition hover:border-zinc-950/20">
              View GitHub
              <Github size={16} />
            </a>
          </div>
        </div>

        <div className="mt-8">
          <HeroDemoStage />
        </div>
      </div>
    </section>
  );
}

function HeroDemoStage() {
  return (
    <article className="hero-demo-stage hero-brief-stage mx-auto overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-white shadow-[0_30px_110px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-950/[0.06] bg-white px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">FounderOS request flow</p>
            <p className="truncate text-[11px] font-medium text-zinc-500">One request becomes one reviewable outcome</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Ready for review</span>
      </div>

      <div className="hero-brief-viewport">
        <div className="hero-brief-grid">
          <div className="hero-request-card rounded-2xl border border-zinc-950/[0.08] bg-zinc-950 p-4 text-white shadow-[0_22px_80px_rgba(15,23,42,0.16)] sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <MessageSquare size={14} />
                Ask FounderOS
              </span>
              <span className="hero-request-status rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-950">Sent</span>
            </div>
            <p className="mt-4 text-base font-semibold leading-7 text-zinc-50">{heroPrompt}</p>
          </div>

          <div className="hero-brief-path" aria-hidden="true">
            <span className="hero-path-dot" />
            <span className="hero-path-line" />
            <span className="hero-path-dot" />
          </div>

          <div className="hero-review-card rounded-2xl border border-zinc-950/[0.08] bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Review package</p>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-zinc-950">Investor update draft</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Ready</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Summary", "Launch plan, risks, and next milestones"],
                ["Sources", "Docs and Sheets referenced"],
                ["Approval", "Email draft waits for your review"],
              ].map(([label, detail]) => (
                <div key={label} className="hero-review-row rounded-xl border border-zinc-950/[0.08] bg-[#fbfaf7] p-3">
                  <p className="text-sm font-semibold text-zinc-950">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ConnectorLogoRow({ connectors }: { connectors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {connectors.map((name) => (
        <div key={name} className="flex items-center gap-2 rounded-lg border border-zinc-950/[0.08] bg-white px-3 py-2 shadow-sm">
          <ConnectorLogo name={name} />
          <span className="text-sm font-semibold text-zinc-800">{name}</span>
        </div>
      ))}
    </div>
  );
}

function ConnectorLogo({ name }: { name: string }) {
  const tool = toolLogos.find((item) => item.name === name);

  if (tool?.icon) return <SimpleBrandIcon icon={tool.icon} className="h-6 w-6 shrink-0" />;
  if (tool?.iconNode) return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">{tool.iconNode}</span>;
  if (name === "Library") return <FileText size={18} className="text-zinc-700" />;

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-[10px] font-bold text-white">
      {name.slice(0, 1)}
    </span>
  );
}

function WebsiteOutputFrame() {
  return (
    <div className="mx-auto overflow-hidden rounded-xl border border-zinc-950/[0.1] bg-white shadow-[0_22px_80px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-950/[0.08] bg-zinc-100 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="truncate rounded-md bg-white px-3 py-1 text-[11px] font-medium text-zinc-500">northstarcrm.com</span>
      </div>
      <div className="relative aspect-[16/9] bg-white">
        <Image
          src="/marketing/demo-output-northstarcrm.png"
          alt="Generated NorthstarCRM marketing website output"
          width={1792}
          height={1024}
          className="h-full w-full object-cover"
          priority
        />
      </div>
    </div>
  );
}

function WorkflowProofSection() {
  const connectors = ["Docs", "Sheets", "GitHub", "Vercel", "Gmail"];

  return (
    <section id="workflow" className="bg-white py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">One strong workflow</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-zinc-950 sm:text-5xl">A launch request becomes reviewable work.</h2>
          <p className="mt-5 text-base leading-7 text-zinc-600 sm:text-lg">
            FounderOS can turn direction, notes, and live service context into a draft update, source summary, preview, and approval gate without making the founder manage tabs or tools.
          </p>
          <div className="mt-6 rounded-xl bg-zinc-950 p-4 text-white shadow-[0_16px_54px_rgba(15,23,42,0.16)]">
            <p className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <MessageSquare size={14} />
              Example request
            </p>
            <p className="mt-3 text-sm font-medium leading-6">{heroPrompt}</p>
          </div>
          <div className="mt-5">
            <ConnectorLogoRow connectors={connectors} />
          </div>
        </div>

        <div className="space-y-4">
          <WebsiteOutputFrame />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Preview", "Ready to review"],
              ["Sources", "Docs and Sheets linked"],
              ["Approval", "Email waits before send"],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-zinc-950/[0.08] bg-[#fbfaf7] p-4">
                <p className="text-sm font-semibold text-zinc-950">{label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolStrip() {
  return (
    <section id="integrations" className="border-y border-zinc-950/[0.06] bg-[#fbfaf7] py-16 sm:py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Live integrations</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-zinc-950 sm:text-5xl">The active services are explicit.</h2>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
            FounderOS markets only the services it can use now: Google Workspace, GitHub, Vercel, and configured local build support.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {toolLogos.map((tool) => (
            <div key={tool.name} className="flex min-h-14 items-center gap-3 rounded-lg border border-zinc-950/[0.08] bg-white px-4 py-3 shadow-sm">
              {tool.icon ? (
                <SimpleBrandIcon icon={tool.icon} className="h-6 w-6 shrink-0" />
              ) : tool.iconNode ? (
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-zinc-700">{tool.iconNode}</span>
              ) : (
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-[11px] font-bold text-white">+</span>
              )}
              <span className="min-w-0 truncate text-sm font-semibold leading-tight text-zinc-800">{tool.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section id="trust" className="bg-white py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.38fr_0.62fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Trust and control</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-zinc-950 sm:text-5xl">The founder stays in control.</h2>
          <p className="mt-5 text-base leading-7 text-zinc-600 sm:text-lg">
            FounderOS can help prepare and organize work, but sensitive actions stop for review before anything public, destructive, or costly happens.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {trustItems.map((item) => (
            <div key={item.title} className="rounded-lg border border-zinc-950/[0.08] bg-[#fbfaf7] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{item.signal}</p>
              <h3 className="mt-3 text-lg font-bold text-zinc-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-y border-zinc-950/[0.06] bg-zinc-950 py-16 text-white sm:py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Ready to try it</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">Start with one founder workflow.</h2>
          <p className="mt-4 text-base leading-7 text-zinc-300">
            Ask FounderOS to prepare a reviewable output from your existing business context, then approve what happens next.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-zinc-950">
            Get started
            <ArrowRight size={16} />
          </Link>
          <Link href="/subscription" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-6 text-sm font-semibold text-white">
            View subscription
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#fbfaf7] py-10">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="font-semibold text-zinc-950">FounderOS</p>
            <p className="text-sm text-zinc-500">One workspace to ask, delegate, review, and reuse business context.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm font-medium text-zinc-600">
          <a href="#product" className="hover:text-zinc-950">Product</a>
          <a href="#workflow" className="hover:text-zinc-950">Workflow</a>
          <a href="#integrations" className="hover:text-zinc-950">Integrations</a>
          <a href="#trust" className="hover:text-zinc-950">Trust</a>
          <Link href="/privacy" className="hover:text-zinc-950">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-950">Terms</Link>
          <a href={githubUrl} className="hover:text-zinc-950">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
