"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Code2,
  Database,
  FileText,
  Github,
  Globe2,
  Layers,
  MailCheck,
  Menu,
  MessageSquare,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  SquareArrowOutUpRight,
  X,
  Workflow,
} from "lucide-react";
import {
  siGithub,
  siVercel,
  type SimpleIcon,
} from "simple-icons";

type ToolLogo = {
  name: string;
  icon?: SimpleIcon;
  iconNode?: React.ReactNode;
};

type WorkflowDemo = {
  id: string;
  label: string;
  title: string;
  text: string;
  prompt: string;
  preview: "website" | "tool" | "document" | "video" | "image";
  accent: string;
  bg: string;
  border: string;
  connectors: string[];
  outputs: Array<{ label: string; detail: string }>;
};

type DemoScene = "request" | "connector" | "working" | "output";

type PricingPlan = {
  id: string;
  name: string;
  price: string;
  cadence?: string;
  summary: string;
  fit: string;
  features: string[];
  featured?: boolean;
};

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Use cases", href: "#use-cases" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
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

const githubUrl = "https://github.com/joshuasknott/founder-os";

const heroPrompt = "Review my launch plan, draft the update, and prepare the preview for approval.";

const workflowDemos: WorkflowDemo[] = [
  {
    id: "websites",
    label: "Websites",
    title: "Describe the site. Get the preview, copy, code, and launch steps.",
    text: "FounderOS turns loose product direction into a reviewable web build, then keeps the change loop and release gate in the same workspace.",
    prompt: "Build a polished launch page for NorthstarCRM with pricing, a product preview, and a launch email.",
    preview: "website",
    accent: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    connectors: ["Docs", "GitHub", "Vercel", "Gmail", "Local build"],
    outputs: [
      { label: "Website preview", detail: "Responsive page ready to review" },
      { label: "Launch copy", detail: "Hero, pricing, email, and changelog" },
      { label: "Release gate", detail: "Publish waits for approval" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    title: "Ask for an operating view and keep the source context attached.",
    text: "Dashboards, summaries, and lightweight working views can be shaped from live workspace context instead of blank-page specs.",
    prompt: "Create a weekly operating dashboard from Sheets, launch notes, and open GitHub work.",
    preview: "tool",
    accent: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    connectors: ["Sheets", "Drive", "GitHub", "Docs"],
    outputs: [
      { label: "Dashboard", detail: "Status, risks, and follow-up views" },
      { label: "Data trail", detail: "Source systems shown inline" },
      { label: "Next actions", detail: "Tasks opened for owners" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    title: "Turn scattered knowledge into docs that are sourced, useful, and saved.",
    text: "FounderOS can use your files, decisions, meetings, and workspace memory to draft reports, briefs, policies, updates, and customer notes.",
    prompt: "Turn the launch notes into an investor update, a sales one-pager, and a customer FAQ.",
    preview: "document",
    accent: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    connectors: ["Drive", "Docs", "Sheets", "Gmail"],
    outputs: [
      { label: "Investor update", detail: "Drafted with source notes" },
      { label: "Sales one-pager", detail: "Positioning and proof points" },
      { label: "FAQ", detail: "Ready for review" },
    ],
  },
];

const workflowFrames = [
  { label: "Prompt", title: "Capture the ask", icon: <MessageSquare size={16} /> },
  { label: "Plan", title: "Shape the work", icon: <Workflow size={16} /> },
  { label: "Connect", title: "Use context", icon: <Database size={16} /> },
  { label: "Create", title: "Produce outputs", icon: <Sparkles size={16} /> },
  { label: "Review", title: "Pause safely", icon: <ShieldCheck size={16} /> },
];

const trustItems = [
  {
    title: "Open source",
    text: "Run FounderOS yourself, extend it, and keep the operating layer inspectable.",
    signal: "Source",
  },
  {
    title: "Managed when useful",
    text: "Use hosted reliability and setup support when you do not want to maintain the runtime.",
    signal: "Hosted",
  },
  {
    title: "Approval-first",
    text: "Sending, publishing, spending, deletion, and live changes stop for review.",
    signal: "Review",
  },
  {
    title: "Cost controls",
    text: "Spending limits and approval rules stay visible before FounderOS takes sensitive action.",
    signal: "Spend",
  },
];

const pricingPlans: PricingPlan[] = [
  {
    id: "open",
    name: "Open source",
    price: "$0",
    summary: "Run FounderOS yourself and bring the local setup you already trust.",
    fit: "Best when you want control and do not mind maintaining your own runtime.",
    features: ["Core workspace", "Home, Work, Library, Schedules, Settings", "Bring your own keys", "Community extensibility"],
  },
  {
    id: "managed",
    name: "FounderOS Managed",
    price: "$29",
    cadence: "/ month",
    summary: "Hosted reliability and managed orchestration for solo founders.",
    fit: "Best when you want the product experience without tending the machinery.",
    features: ["Hosted reliability", "Connector setup support", "Approval-first workflows", "Priority product updates"],
    featured: true,
  },
  {
    id: "team",
    name: "Team",
    price: "Custom",
    summary: "Shared company context, review rules, and support for small teams.",
    fit: "Best when multiple people share company memory and approval controls.",
    features: ["Team workspaces", "Advanced controls", "Custom connector support", "Private onboarding"],
  },
];

const demoScenes: DemoScene[] = ["request", "connector", "working", "output"];

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
      <ToolStrip />
      <UseCasesSection />
      <JourneySection />
      <OrchestrationSection />
      <PricingSection />
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
      <nav className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 sm:px-8">
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
      <div className="relative z-10 mx-auto max-w-[1480px] px-5 pb-10 pt-8 sm:px-8 sm:pb-14 lg:pt-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-950/[0.08] bg-white px-3 py-1 text-xs font-semibold text-zinc-500 shadow-sm">
            <Sparkles size={13} />
            Your live services and company knowledge in one operating workspace
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
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <span className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white">Review draft</span>
              <span className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-950/[0.1] bg-white px-4 text-sm font-semibold text-zinc-700">Open sources</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function useTimedScene(sceneCount: number, intervalMs: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((value) => (value + 1) % sceneCount);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, sceneCount]);

  return activeIndex;
}

function ConnectorLogoRow({ connectors }: { connectors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {connectors.map((name, index) => (
        <div key={name} className="video-logo-token flex items-center gap-2 rounded-xl border border-zinc-950/[0.08] bg-white px-3 py-2 shadow-sm" style={{ animationDelay: `${index * 120}ms` }}>
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

function WebsiteOutputFrame({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mx-auto overflow-hidden rounded-xl border border-zinc-950/[0.1] bg-white shadow-[0_22px_80px_rgba(15,23,42,0.16)] ${compact ? "w-full max-w-2xl" : "max-w-5xl"}`}>
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

function ToolStrip() {
  return (
    <section id="integrations" className="border-b border-zinc-950/[0.06] bg-white py-12 sm:py-14">
      <div className="mx-auto max-w-[1480px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.35fr_0.65fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold leading-tight text-zinc-950 sm:text-4xl">Connect the work to the tools that actually finish it.</h2>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Google Workspace, GitHub, Vercel, local build support, and approval gates stay in one operating loop.
            </p>
            <a href="#orchestration" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-zinc-950">
              See orchestration
              <ChevronRight size={15} />
            </a>
          </div>

          <div className="connector-runway overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-[#fbfaf7] p-3 shadow-sm">
            <div className="connector-rail grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {toolLogos.map((tool, index) => (
                <div
                  key={tool.name}
                  className="connector-chip flex min-h-12 items-center gap-2 rounded-lg border border-zinc-950/[0.08] bg-white px-3 py-2 shadow-sm"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {tool.icon ? (
                    <SimpleBrandIcon icon={tool.icon} className="h-6 w-6 shrink-0" />
                  ) : tool.iconNode ? (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-zinc-700">{tool.iconNode}</span>
                  ) : (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-[11px] font-bold text-white">+</span>
                  )}
                  <span className="min-w-0 truncate text-sm font-medium leading-tight text-zinc-800">{tool.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  return (
    <section id="use-cases" className="bg-[#fbfaf7] py-20 sm:py-24">
      <div className="mx-auto max-w-[1480px] px-5 sm:px-8">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase text-zinc-400">Live workflow examples</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight text-zinc-950 sm:text-5xl">One request can become the whole output, not another tab to manage.</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Each example keeps the explanation beside the product motion: the ask, the live context FounderOS can use, and the reviewable result.
          </p>
        </div>

        <div className="mt-10 divide-y divide-zinc-950/[0.08]">
          {workflowDemos.map((workflow) => (
            <article key={workflow.id} className="workflow-demo-row grid gap-7 py-10 first:pt-0 last:pb-0 lg:grid-cols-[0.42fr_0.58fr] lg:items-center">
              <div className="min-w-0">
                <span className={`inline-flex items-center gap-2 rounded-full border ${workflow.border} ${workflow.bg} px-3 py-1 text-xs font-semibold ${workflow.accent}`}>
                  <WorkflowIcon workflow={workflow} />
                  {workflow.label}
                </span>
                <h3 className="mt-5 text-3xl font-bold leading-tight text-zinc-950 sm:text-4xl">{workflow.title}</h3>
                <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">{workflow.text}</p>

                <div className="mt-6 rounded-xl bg-zinc-950 p-4 text-white shadow-[0_16px_54px_rgba(15,23,42,0.16)]">
                  <p className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <MessageSquare size={14} />
                    Example request
                  </p>
                  <p className="mt-3 text-sm font-medium leading-6">{workflow.prompt}</p>
                </div>

                <div className="mt-5">
                  <ConnectorLogoRow connectors={workflow.connectors} />
                </div>
              </div>

              <WorkflowDemoPanel workflow={workflow} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowIcon({ workflow }: { workflow: WorkflowDemo }) {
  if (workflow.preview === "website") return <Globe2 size={15} />;
  if (workflow.preview === "tool") return <BarChart3 size={15} />;
  if (workflow.preview === "document") return <FileText size={15} />;
  if (workflow.preview === "video") return <Play size={15} fill="currentColor" />;
  return <Sparkles size={15} />;
}

function WorkflowDemoPanel({ workflow }: { workflow: WorkflowDemo }) {
  const sceneIndex = useTimedScene(demoScenes.length, 2500);
  const scene = demoScenes[sceneIndex];
  const sceneMeta = getSceneMeta(workflow, scene);

  return (
    <div className={`workflow-demo-device workflow-${workflow.preview} overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-white shadow-[0_24px_90px_rgba(15,23,42,0.1)]`}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-950/[0.06] bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${workflow.border} ${workflow.bg} ${workflow.accent}`}>
            <WorkflowIcon workflow={workflow} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">{workflow.label} workflow</p>
            <p className="truncate text-xs font-medium text-zinc-500">Live output with connectors</p>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          {demoScenes.map((item, index) => (
            <span
              key={item}
              className={`h-2 rounded-full transition-all duration-300 ${index === sceneIndex ? "w-7 bg-zinc-950" : "w-2 bg-zinc-200"}`}
              aria-label={item}
            />
          ))}
        </div>
      </div>

      <div className="workflow-scene-shell p-4 sm:p-5">
        <div className="workflow-scene-guidance">
          <p className="text-xs font-semibold uppercase text-zinc-400">0{sceneIndex + 1} / {sceneMeta.label}</p>
          <h4 className="mt-2 text-2xl font-bold leading-tight text-zinc-950">{sceneMeta.title}</h4>
          <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-600">{sceneMeta.text}</p>
        </div>

        <div className="workflow-scene-stage mt-5">
          <WorkflowSceneObject workflow={workflow} scene={scene} />
        </div>
      </div>
    </div>
  );
}

function getSceneMeta(workflow: WorkflowDemo, scene: DemoScene) {
  const connector = workflow.connectors[0];

  if (scene === "request") {
    return {
      label: "Ask",
      title: "One clear request starts the work.",
      text: "FounderOS keeps the input focused, then opens the workspace around the task.",
    };
  }

  if (scene === "connector") {
    return {
      label: "Connect",
      title: `${connector} appears only when the workflow needs it.`,
      text: "The connector moment is visible, so the user sees what context is being used.",
    };
  }

  if (scene === "working") {
    return {
      label: "Create",
      title: `The ${workflow.label.toLowerCase()} output takes shape live.`,
      text: "The demo focuses on one object at a time instead of showing every artifact at once.",
    };
  }

  return {
    label: "Output",
    title: "The finished object is ready to review.",
    text: workflow.outputs.map((output) => output.label).join(", "),
  };
}

function WorkflowSceneObject({ workflow, scene }: { workflow: WorkflowDemo; scene: DemoScene }) {
  if (scene === "request") return <FocusedPromptObject workflow={workflow} />;
  if (scene === "connector") return <ConnectorFocusObject workflow={workflow} />;
  if (scene === "working") return <WorkflowWorkingObject workflow={workflow} />;
  return <WorkflowFinalObject workflow={workflow} />;
}

function FocusedPromptObject({ workflow }: { workflow: WorkflowDemo }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-zinc-950/[0.08] bg-zinc-950 p-4 text-white shadow-[0_20px_70px_rgba(15,23,42,0.18)]">
      <p className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs font-semibold text-zinc-300">
        <MessageSquare size={14} />
        Ask FounderOS
      </p>
      <p className="mt-4 text-base font-medium leading-7">{workflow.prompt}</p>
      <div className="mt-5 flex justify-end">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-zinc-950">
          <ArrowRight size={17} />
        </span>
      </div>
    </div>
  );
}

function ConnectorFocusObject({ workflow }: { workflow: WorkflowDemo }) {
  const connector = workflow.connectors[0];

  return (
    <div className="mx-auto flex min-h-72 max-w-lg items-center justify-center">
      <div className="workflow-connector-focus rounded-2xl border border-zinc-950/[0.08] bg-white p-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${workflow.border} ${workflow.bg}`}>
          <ConnectorLogo name={connector} />
        </span>
        <h5 className="mt-5 text-2xl font-bold text-zinc-950">{connector}</h5>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Connected for this step</p>
      </div>
    </div>
  );
}

function WorkflowWorkingObject({ workflow }: { workflow: WorkflowDemo }) {
  if (workflow.preview === "website") {
    return (
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-1.5 border-b border-zinc-950/[0.08] bg-zinc-100 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="p-5">
          <div className="h-8 w-2/3 rounded-lg bg-emerald-100" />
          <div className="mt-4 grid gap-3 sm:grid-cols-[0.48fr_0.52fr]">
            <div className="space-y-2">
              <div className="h-3 rounded-full bg-zinc-200" />
              <div className="h-3 w-5/6 rounded-full bg-zinc-200" />
              <div className="mt-4 h-9 w-28 rounded-lg bg-zinc-950" />
            </div>
            <div className="rounded-xl bg-[#fbfaf7] p-3">
              <div className="workflow-scan h-28 rounded-lg bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (workflow.preview === "tool") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-zinc-950/[0.08] bg-zinc-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Revenue health</p>
            <p className="text-xs text-zinc-400">Live dashboard build</p>
          </div>
          <span className="rounded-full bg-sky-300 px-2.5 py-1 text-[11px] font-semibold text-zinc-950">Syncing</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["MRR", "$84.2k", "+12%"],
            ["Churn risk", "14", "Needs action"],
            ["Pipeline", "$192k", "Weighted"],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-xl bg-white/10 p-3">
              <p className="text-[11px] font-semibold uppercase text-zinc-400">{label}</p>
              <p className="mt-2 text-lg font-bold">{value}</p>
              <p className="mt-1 text-[11px] text-zinc-400">{detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[74, 48, 88, 62].map((width, index) => (
            <div key={width} className="h-3 overflow-hidden rounded-full bg-zinc-100">
              <span className="workflow-bar block h-full rounded-full bg-sky-300" style={{ width: `${width}%`, animationDelay: `${index * 140}ms` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (workflow.preview === "document") {
    return (
      <div className="workflow-paper mx-auto max-w-md rounded-[10px] border border-zinc-950/[0.1] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-zinc-950/[0.08] pb-5">
          <p className="text-xs font-semibold uppercase text-violet-600">Draft document</p>
          <h4 className="mt-2 text-xl font-bold leading-tight text-zinc-950">Investor update: Pricing launch</h4>
        </div>
        <div className="mt-5 space-y-3">
          {["Highlights", "Revenue signal", "Customer proof", "Next milestones"].map((item, index) => (
            <div key={item} className="workflow-doc-line rounded-lg bg-[#fbfaf7] p-3" style={{ animationDelay: `${index * 130}ms` }}>
              <p className="text-sm font-semibold text-zinc-950">{item}</p>
              <div className="mt-2 space-y-1.5">
                <span className="block h-2 rounded-full bg-violet-100" />
                <span className="block h-2 w-4/5 rounded-full bg-violet-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (workflow.preview === "video") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-zinc-950/[0.08] bg-white p-3 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-950 text-white">
          <Image src="/marketing/founder-workspace-hero.png" alt="" width={1600} height={1000} className="h-full w-full object-cover opacity-55" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg">
              <Play size={22} fill="currentColor" />
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/55 p-3 backdrop-blur">
            <p className="text-xs font-semibold">Scene 03: product proof</p>
            <p className="mt-1 text-[11px] text-zinc-300">Caption and voiceover aligned</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
          <span className="workflow-playhead block h-full rounded-full bg-rose-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-campaign-canvas mx-auto max-w-xl rounded-2xl border border-zinc-950/[0.08] bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
        <Image src="/marketing/usecase-product-build-v2.png" alt="" fill sizes="(max-width: 1024px) 80vw, 420px" className="object-cover" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-950">Launch visual direction</p>
          <p className="mt-1 text-xs text-zinc-500">Selected social card</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Export</span>
      </div>
    </div>
  );
}

function WorkflowFinalObject({ workflow }: { workflow: WorkflowDemo }) {
  if (workflow.preview === "website") return <WebsiteOutputFrame compact />;

  return (
    <div className={`workflow-final-object workflow-final-${workflow.preview} mx-auto max-w-xl rounded-2xl border border-zinc-950/[0.08] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]`}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl border ${workflow.border} ${workflow.bg} ${workflow.accent}`}>
        <WorkflowIcon workflow={workflow} />
      </span>
      <p className="mt-5 text-xs font-semibold uppercase text-zinc-400">Final output</p>
      <h5 className="mt-2 text-2xl font-bold leading-tight text-zinc-950">{workflow.outputs[0].label}</h5>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{workflow.outputs[0].detail}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {workflow.outputs.slice(1).map((output) => (
          <span key={output.label} className="rounded-full border border-zinc-950/[0.08] bg-[#fbfaf7] px-3 py-1.5 text-xs font-semibold text-zinc-600">
            {output.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function JourneySection() {
  return (
    <section className="border-y border-zinc-950/[0.06] bg-white py-20 sm:py-24">
      <div className="mx-auto grid max-w-[1480px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <h2 className="text-4xl font-bold leading-tight text-zinc-950 sm:text-5xl">The interface stays simple until the work needs depth.</h2>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            FounderOS starts with the prompt box, then expands into transparent progress, connected context, outputs, previews, and review checkpoints.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["Simple input", "Visible progress", "Saved outputs", "Approval gates"].map((item) => (
              <span key={item} className="rounded-full border border-zinc-950/[0.08] bg-[#fbfaf7] px-3 py-1.5 text-sm font-medium text-zinc-700">
                {item}
              </span>
            ))}
          </div>
        </div>

        <WorkflowFilm />
      </div>
    </section>
  );
}

function WorkflowFilm() {
  return (
    <div className="workflow-film overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-[#fbfaf7] p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-5">
        {workflowFrames.map((frame, index) => (
          <div key={frame.label} className="workflow-frame rounded-lg border border-zinc-950/[0.08] bg-white p-3 shadow-sm" style={{ animationDelay: `${index * 550}ms` }}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white">{frame.icon}</span>
              <span className="text-[11px] font-semibold text-zinc-400">0{index + 1}</span>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{frame.label}</p>
            <h3 className="mt-2 text-sm font-semibold text-zinc-950">{frame.title}</h3>
          </div>
        ))}
      </div>

      <div className="mt-4 grid overflow-hidden rounded-xl border border-zinc-950/[0.08] bg-white lg:grid-cols-[0.46fr_0.54fr]">
        <div className="border-b border-zinc-950/[0.06] p-5 lg:border-b-0 lg:border-r">
          <p className="text-sm font-semibold text-zinc-950">Build a launch page, summarize the revenue impact, and prepare a customer note.</p>
          <div className="mt-4 space-y-2">
            {["Plan drafted", "Connectors selected", "Outputs generated", "Review needed"].map((item, index) => (
              <div key={item} className="flex items-center gap-2 text-sm text-zinc-700">
                <span className={`h-2 w-2 rounded-full ${index < 3 ? "bg-emerald-500" : "bg-amber-400"}`} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {[
            { label: "Website", icon: <Globe2 size={16} />, detail: "Preview" },
            { label: "Doc", icon: <FileText size={16} />, detail: "Saved" },
            { label: "Email", icon: <MailCheck size={16} />, detail: "Approval" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-zinc-950/[0.08] bg-[#fbfaf7] p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-950 shadow-sm">{item.icon}</span>
              <p className="mt-4 text-sm font-semibold text-zinc-950">{item.label}</p>
              <p className="mt-1 text-xs font-medium text-zinc-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrchestrationSection() {
  return (
    <section id="orchestration" className="bg-[#fbfaf7] py-20 sm:py-24">
      <div className="mx-auto grid max-w-[1480px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <h2 className="text-4xl font-bold leading-tight text-zinc-950 sm:text-5xl">One operating layer for context, live tools, and approvals.</h2>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            FounderOS can run open source with your setup or managed with hosted orchestration. The visible experience stays focused on work, not provider plumbing.
          </p>
          <div className="mt-8 divide-y divide-zinc-950/[0.07] rounded-2xl border border-zinc-950/[0.08] bg-white shadow-sm">
            {trustItems.map((item) => (
              <div key={item.title} className="grid gap-3 p-5 sm:grid-cols-[0.22fr_0.78fr]">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{item.signal}</span>
                <span>
                  <span className="block text-base font-semibold text-zinc-950">{item.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-zinc-600">{item.text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <OrchestrationDemo />
      </div>
    </section>
  );
}

function OrchestrationDemo() {
  const routes = [
    { label: "Context", icon: <Database size={16} />, detail: "Docs, memory, decisions" },
    { label: "Build", icon: <Code2 size={16} />, detail: "Local build, GitHub" },
    { label: "Operate", icon: <RefreshCw size={16} />, detail: "Schedules and workflows" },
    { label: "Plan", icon: <BarChart3 size={16} />, detail: "Docs and Sheets context" },
    { label: "Publish", icon: <Globe2 size={16} />, detail: "Vercel and previews" },
    { label: "Review", icon: <ShieldCheck size={16} />, detail: "Approval gates" },
  ];

  return (
    <div className="orchestration-demo relative overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.1)]">
      <div className="rounded-xl border border-zinc-950/[0.08] bg-zinc-950 p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-zinc-950">
            <Layers size={18} />
          </span>
          <div>
            <p className="text-base font-semibold">FounderOS</p>
            <p className="text-sm text-zinc-300">Operating layer</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <span className="orchestration-progress block h-full rounded-full bg-teal-300" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {routes.map((route, index) => (
          <div key={route.label} className="orchestration-route rounded-lg border border-zinc-950/[0.08] bg-[#fbfaf7] p-4" style={{ animationDelay: `${index * 160}ms` }}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-950 shadow-sm">{route.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-zinc-950">{route.label}</span>
                <span className="block text-xs leading-5 text-zinc-500">{route.detail}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingSection() {
  const [selectedPlanId, setSelectedPlanId] = useState("managed");
  const selectedPlan = pricingPlans.find((plan) => plan.id === selectedPlanId) ?? pricingPlans[1];

  return (
    <section id="pricing" className="border-y border-zinc-950/[0.06] bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-[1480px] px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase text-zinc-400">Pricing</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight text-zinc-950 sm:text-5xl">Pick the operating mode that fits how much you want to own.</h2>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Start with self-hosted control, move to managed momentum, or bring the workspace into a team setting when shared memory and controls matter.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {pricingPlans.map((plan) => {
            const selected = selectedPlan.id === plan.id;

            return (
              <button
                key={plan.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`pricing-plan-card rounded-2xl border p-5 text-left transition ${
                  selected ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]" : "border-zinc-950/[0.08] bg-[#fbfaf7] text-zinc-950 hover:border-zinc-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold">{plan.name}</p>
                    <p className={`mt-2 text-sm leading-6 ${selected ? "text-zinc-300" : "text-zinc-600"}`}>{plan.summary}</p>
                  </div>
                  {plan.featured && <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selected ? "bg-white text-zinc-950" : "bg-zinc-950 text-white"}`}>Managed</span>}
                </div>
                <p className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  {plan.cadence && <span className={`pb-1 text-sm font-medium ${selected ? "text-zinc-300" : "text-zinc-500"}`}>{plan.cadence}</span>}
                </p>
                <p className={`mt-4 text-sm leading-6 ${selected ? "text-zinc-300" : "text-zinc-600"}`}>{plan.fit}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-[#fbfaf7] shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:grid-cols-[0.38fr_0.62fr]">
          <div className="bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-zinc-500">Selected plan</p>
            <h3 className="mt-3 text-3xl font-bold leading-tight text-zinc-950">{selectedPlan.name}</h3>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{selectedPlan.summary}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/subscription" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white">
                View subscription
                <ArrowRight size={15} />
              </Link>
              <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-950/[0.12] bg-white px-5 text-sm font-semibold text-zinc-950">
                Get started
                <SquareArrowOutUpRight size={15} />
              </Link>
            </div>
          </div>

          <div className="border-t border-zinc-950/[0.08] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-zinc-950">What this includes</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {selectedPlan.features.map((feature) => (
                <div key={feature} className="flex gap-3 rounded-xl border border-zinc-950/[0.08] bg-white p-4">
                  <Check size={16} className="mt-0.5 shrink-0 text-teal-600" />
                  <span className="text-sm leading-6 text-zinc-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#fbfaf7] py-12">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="font-semibold text-zinc-950">FounderOS</p>
            <p className="text-sm text-zinc-500">One workspace to ask, delegate, review, and reuse business context.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm font-medium text-zinc-600">
          <a href="#product" className="hover:text-zinc-950">Product</a>
          <a href="#use-cases" className="hover:text-zinc-950">Use cases</a>
          <a href="#integrations" className="hover:text-zinc-950">Integrations</a>
          <Link href="/subscription" className="hover:text-zinc-950">Subscription</Link>
          <Link href="/privacy" className="hover:text-zinc-950">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-950">Terms</Link>
          <a href={githubUrl} className="hover:text-zinc-950">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
