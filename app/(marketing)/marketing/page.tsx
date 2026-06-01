"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Home,
  Library,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  Users,
  Zap,
  FileText,
  Brain,
  Globe,
  Lock,
  Clock,
  Layers,
  Search,
  Workflow,
  Star,
  Mail,
  GitBranch,
  X,
  Check,
} from "lucide-react";

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Scroll reveal hook
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible] as const;
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Typewriter effect
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function useTypewriter(phrases: string[], speed = 60, pause = 2000) {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setText(currentPhrase.slice(0, charIndex + 1));
          setCharIndex((prev) => prev + 1);

          if (charIndex + 1 === currentPhrase.length) {
            setTimeout(() => setIsDeleting(true), pause);
          }
        } else {
          setText(currentPhrase.slice(0, charIndex - 1));
          setCharIndex((prev) => prev - 1);

          if (charIndex <= 1) {
            setIsDeleting(false);
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
          }
        }
      },
      isDeleting ? speed / 2 : speed
    );

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex, phrases, speed, pause]);

  return text;
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Main Marketing Page
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

export default function MarketingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-50" />

      <Navbar scrollY={scrollY} />
      <HeroSection />
      <LogoBar />
      <ProductOverview />
      <ConnectorsShowcase />
      <HowItWorks />
      <UseCasesSection />
      <FeaturesDeepDive />
      <ComparisonSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Navbar
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function Navbar({ scrollY }: { scrollY: number }) {
  const isScrolled = scrollY > 50;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        isScrolled
          ? "bg-black/80 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/marketing" className="flex items-center gap-2 group">
          <span className="text-lg font-extrabold tracking-tight transition-opacity group-hover:opacity-80">FounderOS</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-zinc-400 transition hover:text-white">
            Features
          </a>
          <a href="#integrations" className="text-sm font-medium text-zinc-400 transition hover:text-white">
            Integrations
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-zinc-400 transition hover:text-white">
            How it works
          </a>
          <a href="#pricing" className="text-sm font-medium text-zinc-400 transition hover:text-white">
            Pricing
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="btn-shimmer rounded-lg px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 md:hidden"
          aria-label="Toggle menu"
        >
          <div className="flex flex-col gap-1">
            <span className={`block h-0.5 w-5 bg-white transition-transform ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-white transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-white transition-transform ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-black/95 backdrop-blur-xl px-6 py-6 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#features" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-zinc-300 hover:text-white">Features</a>
            <a href="#integrations" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-zinc-300 hover:text-white">Integrations</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-zinc-300 hover:text-white">How it works</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-zinc-300 hover:text-white">Pricing</a>
            <div className="h-px bg-white/[0.06]" />
            <Link href="/" className="text-sm font-semibold text-zinc-300 hover:text-white">Sign in</Link>
            <Link href="/" className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-bold text-black">Get started</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Hero Section
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function HeroSection() {
  const typedText = useTypewriter(
    [
      "Draft an investor update",
      "Summarize customer feedback",
      "Create a competitive analysis",
      "Prepare board meeting notes",
      "Schedule weekly reports",
    ],
    50,
    2500
  );

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient mesh background */}
      <div className="mesh-gradient absolute inset-0" />
      <div className="grid-bg absolute inset-0" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="particle-1 absolute top-[15%] left-[10%] h-1 w-1 rounded-full bg-white/30" />
        <div className="particle-2 absolute top-[25%] right-[15%] h-1.5 w-1.5 rounded-full bg-white/20" />
        <div className="particle-3 absolute top-[60%] left-[20%] h-1 w-1 rounded-full bg-white/25" />
        <div className="particle-4 absolute top-[70%] right-[25%] h-2 w-2 rounded-full bg-white/15" />
        <div className="particle-5 absolute top-[40%] left-[70%] h-1 w-1 rounded-full bg-white/20" />
        <div className="particle-1 absolute top-[80%] left-[50%] h-1.5 w-1.5 rounded-full bg-white/15" />
        <div className="particle-2 absolute top-[10%] left-[60%] h-1 w-1 rounded-full bg-white/25" />
        <div className="particle-3 absolute top-[50%] right-[10%] h-1 w-1 rounded-full bg-white/20" />
      </div>

      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] radial-glow-top" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-32 pb-20 text-center lg:px-8">
        {/* Badge */}
        <div className="reveal-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-zinc-300">
            Now in early access
          </span>
        </div>

        {/* Main heading */}
        <h1 className="reveal-up stagger-1 text-5xl font-extrabold tracking-tight leading-[1.1] sm:text-6xl lg:text-7xl xl:text-8xl" style={{ opacity: 0 }}>
          <span className="block">Run your business</span>
          <span className="gradient-text block">with an AI team</span>
        </h1>

        {/* Subtitle */}
        <p className="reveal-up stagger-3 mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl" style={{ opacity: 0 }}>
          FounderOS is your AI-powered business assistant that handles the work you
          don&apos;t have time for. Delegate tasks in plain English, and get polished
          results â€” emails drafted, reports built, code shipped â€” all with your approval.
        </p>

        {/* Simulated prompt box */}
        <div className="reveal-up stagger-4 mx-auto mt-12 max-w-xl" style={{ opacity: 0 }}>
          <div className="flowing-border rounded-2xl bg-white/[0.04] p-1">
            <div className="rounded-xl bg-zinc-950 px-6 py-4">
              <div className="flex items-center gap-3 text-left">
                <Sparkles size={16} className="shrink-0 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  {typedText}
                  <span className="inline-block w-[2px] h-4 bg-zinc-500 ml-0.5 animate-pulse align-middle" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="reveal-up stagger-5 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ opacity: 0 }}>
          <Link
            href="/"
            className="btn-shimmer group inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            Start building for free
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-3.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            See how it works
          </a>
        </div>

        {/* Hero product screenshot */}
        <div className="reveal-up stagger-6 mt-20" style={{ opacity: 0 }}>
          <div className="screenshot-tilt">
            <div className="screenshot-tilt-inner relative overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/50 shadow-2xl shadow-black/50">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 z-10 pointer-events-none" />
              <img
                src="/marketing/hero-dashboard.png"
                alt="FounderOS Dashboard"
                className="w-full h-auto object-cover object-top"
                style={{ aspectRatio: "16/9" }}
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Inline Brand Icons for Marketing Page
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function BrandIcon({ id, className = "h-4 w-4" }: { id: string; className?: string }) {
  const icons: Record<string, { path: string; color: string; viewBox?: string }> = {
    gmail: {
      path: "M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z",
      color: "#EA4335",
    },
    google_calendar: {
      path: "M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H5.684v5.684h12.632zM5.684 18.316H0V5.684h5.684v12.632zM18.316 18.316H24V24h-5.684v-5.684zM0 18.316h5.684V24H0v-5.684zM0 0h5.684v5.684H0V0z",
      color: "#4285F4",
    },
    google_drive: {
      path: "M12 0L0 20.556h4.8L16.8 0H12zM7.2 0L0 12.444h4.8L12 0H7.2zM4.8 20.556L12 8.112l7.2 12.444H4.8zM19.2 20.556L12 8.112l2.4-4.146 9.6 16.59H19.2z",
      color: "#4285F4",
    },
    google_docs: {
      path: "M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6.001zm-1.909 13.91H7.636v-1.637h5.182v1.636zm3.273-3.273H7.636v-1.637h8.455v1.637zm0-3.273H7.636V12.455h8.455v1.636zM14.727 6.727V0l6.546 6.727h-6.546z",
      color: "#4285F4",
    },
    google_sheets: {
      path: "M19.09 1.636H4.91c-.905 0-1.637.732-1.637 1.637v17.454c0 .905.732 1.637 1.636 1.637h14.182c.904 0 1.636-.732 1.636-1.637V3.273c0-.905-.732-1.637-1.636-1.637zM9.273 19.09H5.727v-2.454h3.546v2.455zm0-4.09H5.727v-2.455h3.546V15zm0-4.09H5.727V8.454h3.546v2.455zm8.454 8.181h-6.545v-2.454h6.545v2.455zm0-4.09h-6.545v-2.455h6.545V15zm0-4.09h-6.545V8.454h6.545v2.455z",
      color: "#0F9D58",
    },
    opencode: {
      path: "M3 3h18v6h-6v6h6v6H3v-6h6V9H3V3z",
      color: "#ffffff",
    },
    github: {
      path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
      color: "#ffffff",
    },
    vercel: {
      path: "M12 1L24 22H0z",
      color: "#ffffff",
    },
  };

  const icon = icons[id];
  if (!icon) return null;

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill={icon.color} d={icon.path} />
    </svg>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Logo Bar / Social Proof
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function LogoBar() {
  const [revealRef, revealVisible] = useScrollReveal();

  const integrations = [
    { id: "gmail", name: "Gmail" },
    { id: "google_calendar", name: "Google Calendar" },
    { id: "google_drive", name: "Google Drive" },
    { id: "google_docs", name: "Google Docs" },
    { id: "google_sheets", name: "Google Sheets" },
    { id: "opencode", name: "OpenCode" },
    { id: "github", name: "GitHub" },
    { id: "vercel", name: "Vercel" },
  ];

  return (
    <section className="relative border-t border-b border-white/[0.04] py-16 overflow-hidden">
      <div
        ref={revealRef}
        className={`mx-auto max-w-7xl px-6 text-center transition-all duration-700 ${
          revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          Connects with the tools you already use
        </p>
        <p className="mb-10 text-sm text-zinc-600">
          One-click connections. Zero engineering required.
        </p>

        {/* Integration marquee */}
        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10" />
          <div className="flex animate-marquee whitespace-nowrap">
            {[...integrations, ...integrations].map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="mx-4 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 connector-icon-glow"
              >
                <BrandIcon id={item.id} className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold text-zinc-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { value: "8", label: "Integrations" },
            { value: "âˆž", label: "Tasks delegated" },
            { value: "24/7", label: "Always running" },
            { value: "< 1min", label: "Average response" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`transition-all duration-700 ${
                revealVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${i * 100 + 200}ms` }}
            >
              <p className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Product Overview â€” Bento Grid
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function ProductOverview() {
  const [revealRef, revealVisible] = useScrollReveal();

  const surfaces = [
    {
      icon: Home,
      title: "Home",
      desc: "Your universal command surface. Ask questions, start tasks, and get AI-powered suggestions â€” all from one intelligent prompt.",
      image: "/marketing/hero-dashboard.png",
      span: "col-span-2 row-span-2",
      tag: "Command Center",
    },
    {
      icon: BriefcaseBusiness,
      title: "Work",
      desc: "See what's active, what needs review, and what's done. FounderOS reports progress in real-time.",
      image: "/marketing/work-dashboard.png",
      span: "col-span-1 row-span-1",
      tag: "Task Flow",
    },
    {
      icon: Library,
      title: "Library",
      desc: "Queryable business knowledge â€” search, summarize, and reuse everything your business knows.",
      image: "/marketing/library-dashboard.png",
      span: "col-span-1 row-span-1",
      tag: "Knowledge Base",
    },
    {
      icon: CalendarClock,
      title: "Schedules",
      desc: "Recurring work in plain language. \"Send priorities every morning\" â€” that simple.",
      image: "/marketing/schedules-dashboard.png",
      span: "col-span-1 row-span-1",
      tag: "Automation",
    },
    {
      icon: Settings,
      title: "Settings",
      desc: "Connected services, review rules, spending limits, and preferences. Full control over how FounderOS works for you.",
      image: null,
      span: "col-span-1 row-span-1",
      tag: "Configuration",
    },
  ];

  return (
    <section id="features" className="relative py-32">
      <div className="radial-glow absolute inset-0 pointer-events-none" />

      <div
        ref={revealRef}
        className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8"
      >
        {/* Section header */}
        <div
          className={`mb-16 max-w-2xl transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Five surfaces, one workspace
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl">
            Everything your business needs.{" "}
            <span className="text-zinc-500">Nothing it doesn&apos;t.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            FounderOS organizes your AI workspace into five intuitive surfaces â€”
            each designed for a specific way of working with your business.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid auto-rows-[280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {surfaces.map((surface, i) => {
            const Icon = surface.icon;
            const isLarge = i === 0;

            return (
              <div
                key={surface.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-500 glass-dark-hover ${
                  isLarge ? "sm:col-span-2 sm:row-span-2" : ""
                } ${
                  revealVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${i * 100 + 100}ms` }}
              >
                {/* Card content */}
                <div className="relative z-10 flex h-full flex-col justify-between p-6">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.06]">
                        <Icon size={16} className="text-zinc-300" />
                      </div>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        {surface.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {surface.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 max-w-sm">
                      {surface.desc}
                    </p>
                  </div>

                  {surface.image && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06]">
                      <img
                        src={surface.image}
                        alt={`${surface.title} interface`}
                        className="w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                        style={{ maxHeight: isLarge ? "340px" : "120px" }}
                        loading="lazy"
                      />
                    </div>
                  )}

                  {!surface.image && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {["Connections", "Rules", "Limits", "Team"].map((item) => (
                        <div
                          key={item}
                          className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs font-semibold text-zinc-500"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtle glow on hover */}
                <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-white/[0.03] to-transparent" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Connectors Showcase
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function ConnectorsShowcase() {
  const [revealRef, revealVisible] = useScrollReveal();

  const connectorGroups = [
    {
      title: "Google Workspace",
      icon: Mail,
      connectors: [
        { id: "gmail", name: "Gmail", desc: "Draft replies, find useful email context, and prepare outbound messages.", active: true },
        { id: "google_calendar", name: "Google Calendar", desc: "Read your schedule and prepare meeting changes.", active: true },
        { id: "google_drive", name: "Google Drive", desc: "Import useful files into Library context.", active: true },
        { id: "google_docs", name: "Google Docs", desc: "Import documents and export approved drafts.", active: true },
        { id: "google_sheets", name: "Google Sheets", desc: "Read and analyze spreadsheet data for business context.", active: true },
      ],
    },
    {
      title: "Code & Hosting",
      icon: GitBranch,
      connectors: [
        { id: "opencode", name: "OpenCode", desc: "Prepare product-building work privately on your computer.", active: true },
        { id: "github", name: "GitHub", desc: "Read repository context and prepare approved code changes.", active: true },
        { id: "vercel", name: "Vercel", desc: "Create private review links and publish only after approval.", active: true },
      ],
    },
  ];

  return (
    <section id="integrations" className="relative py-32">
      <div className="grid-bg-fine absolute inset-0" />

      <div ref={revealRef} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div
          className={`mb-6 text-center transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Integrations
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Connects to your entire stack.{" "}
            <span className="text-zinc-500">Natively.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
            From Google Workspace to product work, FounderOS plugs into the tools you already use.
            Every connection is secure, scoped, and approval-protected.
          </p>
        </div>

        {/* Connector groups */}
        <div className="space-y-8">
          {connectorGroups.map((group, gi) => {
            const GroupIcon = group.icon;

            return (
              <div
                key={group.title}
                className={`transition-all duration-700 ${
                  revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${gi * 100 + 150}ms` }}
              >
                {/* Group header */}
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.06]">
                    <GroupIcon size={14} className="text-zinc-400" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-300">{group.title}</h3>
                </div>

                {/* Connector cards row */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {group.connectors.map((connector) => (
                    <div
                      key={connector.id}
                      className={`connector-card group relative rounded-xl border bg-white/[0.02] p-4 ${
                        connector.active
                          ? "border-white/[0.08]"
                          : "border-white/[0.04] opacity-70"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                          connector.active
                            ? "border-white/[0.08] bg-white/[0.04]"
                            : "border-white/[0.04] bg-white/[0.02]"
                        }`}>
                          <BrandIcon id={connector.id} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{connector.name}</p>
                            {connector.active ? (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                                Soon
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
                            {connector.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Security note */}
        <div
          className={`mt-12 flex items-center justify-center gap-3 transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "600ms" }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Lock size={14} className="text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500">
            Every connection is <span className="font-semibold text-zinc-400">workspace-isolated</span>,{" "}
            <span className="font-semibold text-zinc-400">scoped to minimum permissions</span>, and{" "}
            <span className="font-semibold text-zinc-400">approval-protected</span> for sensitive actions.
          </p>
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   How It Works
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function HowItWorks() {
  const [revealRef, revealVisible] = useScrollReveal();

  const steps = [
    {
      step: "01",
      title: "Just ask",
      desc: "Type what you need like you'd message an assistant. No setup, no workflow builders â€” just plain English.",
      icon: MessageSquare,
      example: '"Prepare this week\'s investor update with revenue numbers"',
    },
    {
      step: "02",
      title: "FounderOS gets to work",
      desc: "It connects to your tools, pulls the right data, and does the actual work â€” writing, researching, building. You can watch progress in real-time.",
      icon: Zap,
      example: "Finds the right context, drafts the email, formats everything",
    },
    {
      step: "03",
      title: "You approve the result",
      desc: "Nothing goes out without your say-so. Review the finished work, make tweaks if needed, and hit approve. You're always in control.",
      icon: CheckCircle2,
      example: "Review the draft, tweak if needed, send",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-32">
      <div className="radial-glow-top absolute inset-0 pointer-events-none" />

      <div ref={revealRef} className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8">
        <div
          className={`mb-20 text-center transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Simple by design
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            How it works.{" "}
            <span className="text-zinc-500">It&apos;s this simple.</span>
          </h2>
        </div>

        <div className="relative">
          {/* Connecting vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.1] via-white/[0.05] to-transparent hidden sm:block" />

          <div className="space-y-16">
            {steps.map((step, i) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.step}
                  className={`relative flex gap-8 sm:gap-12 transition-all duration-700 ${
                    revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${i * 200 + 200}ms` }}
                >
                  {/* Step number */}
                  <div className="relative z-10 hidden sm:block">
                    <div className="glow-card flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-zinc-900">
                      <span className="text-sm font-extrabold text-white">{step.step}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 glass-dark-hover">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                        <Icon size={20} className="text-zinc-300" />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 sm:hidden">
                          Step {step.step}
                        </span>
                        <h3 className="text-xl font-bold text-white mt-1 sm:mt-0">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                          {step.desc}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2">
                          <ChevronRight size={12} className="text-zinc-600" />
                          <span className="text-xs font-medium text-zinc-500 italic">
                            {step.example}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Use Cases â€” Real Workflow Scenarios
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function UseCasesSection() {
  const [revealRef, revealVisible] = useScrollReveal();
  const [activeCase, setActiveCase] = useState(0);

  const useCases = [
    {
      title: "Weekly investor update",
      scenario: "\"Prepare this week's investor update\"",
      outcome: "A polished investor email, drafted and ready to review in your inbox â€” in under 5 minutes.",
      steps: [
        { actor: "You", action: "Ask FounderOS to prepare the weekly investor update", connectors: [] },
        { actor: "FounderOS", action: "Pulls the right business context from Google Workspace", connectors: ["google_drive", "google_sheets"] },
        { actor: "FounderOS", action: "Analyzes week-over-week trends and highlights key wins", connectors: [] },
        { actor: "FounderOS", action: "Formats the update with charts and a clean layout", connectors: [] },
        { actor: "FounderOS", action: "Prepares a Gmail draft for your review", connectors: ["gmail"] },
      ],
    },
    {
      title: "Ship a website update",
      scenario: "\"Update the pricing page to add a new tier\"",
      outcome: "A preview deployment ready to review â€” your live site untouched until you approve.",
      steps: [
        { actor: "You", action: "Describe the change you want in plain English", connectors: [] },
        { actor: "FounderOS", action: "Pulls your current codebase from GitHub", connectors: ["github"] },
        { actor: "FounderOS", action: "Makes the code changes in a safe, isolated environment", connectors: [] },
        { actor: "FounderOS", action: "Creates a preview deployment for you to review", connectors: ["vercel"] },
        { actor: "You", action: "Review the preview, approve to go live", connectors: [] },
      ],
    },
    {
      title: "Research a competitor",
      scenario: "\"Create a competitive analysis of Acme Corp\"",
      outcome: "A thorough competitor brief saved to your knowledge base â€” ready to reference anytime.",
      steps: [
        { actor: "You", action: "Ask for a competitive analysis of a specific company", connectors: [] },
        { actor: "FounderOS", action: "Researches their product, pricing, and positioning", connectors: [] },
        { actor: "FounderOS", action: "Cross-references with your existing business knowledge", connectors: [] },
        { actor: "FounderOS", action: "Creates a structured brief with comparisons", connectors: [] },
        { actor: "FounderOS", action: "Saves it to your Library for future reference", connectors: [] },
      ],
    },
    {
      title: "Reply to a customer email",
      scenario: "\"Draft a response to Jane's support email\"",
      outcome: "A thoughtful, on-brand reply in your Gmail drafts â€” nothing sent without your approval.",
      steps: [
        { actor: "You", action: "Ask FounderOS to handle a specific customer email", connectors: [] },
        { actor: "FounderOS", action: "Reads the email thread and understands the question", connectors: ["gmail"] },
        { actor: "FounderOS", action: "Looks up relevant past decisions and context", connectors: [] },
        { actor: "FounderOS", action: "Drafts a response in your voice and tone", connectors: [] },
        { actor: "FounderOS", action: "Places the draft in Gmail for your review", connectors: ["gmail"] },
      ],
    },
  ];

  const currentCase = useCases[activeCase];

  const actorColors: Record<string, string> = {
    You: "bg-white text-black",
    FounderOS: "bg-zinc-700 text-zinc-200 border-zinc-600",
  };

  return (
    <section className="relative py-32">
      <div className="radial-glow absolute inset-0 pointer-events-none" />

      <div ref={revealRef} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div
          className={`mb-16 text-center transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Real workflows
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            See it in action.{" "}
            <span className="text-zinc-500">Not just feature lists.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Real examples of how founders use FounderOS to get things done â€”
            from start to finish, with every step visible.
          </p>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          {/* Left: Use case selector */}
          <div
            className={`flex flex-col gap-2 lg:w-80 shrink-0 transition-all duration-700 ${
              revealVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            {useCases.map((uc, i) => (
              <button
                key={uc.title}
                type="button"
                onClick={() => setActiveCase(i)}
                className={`use-case-card text-left rounded-xl border p-4 ${
                  activeCase === i
                    ? "border-white/[0.15] bg-white/[0.06]"
                    : "border-white/[0.04] bg-white/[0.02]"
                }`}
              >
                <p className={`text-sm font-bold ${
                  activeCase === i ? "text-white" : "text-zinc-400"
                }`}>
                  {uc.title}
                </p>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  {uc.scenario}
                </p>
              </button>
            ))}
          </div>

          {/* Right: Step-by-step flow */}
          <div
            className={`flex-1 transition-all duration-700 ${
              revealVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
              {/* Flow steps */}
              <div className="space-y-1">
                {currentCase.steps.map((step, si) => (
                  <div key={`${activeCase}-${si}`} className="flex gap-4">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                        actorColors[step.actor] ?? "bg-zinc-800 text-zinc-400"
                      }`}>
                        {step.actor === "You" ? "You" : step.actor.slice(0, 2)}
                      </div>
                      {si < currentCase.steps.length - 1 && (
                        <div className="w-px flex-1 bg-gradient-to-b from-white/[0.1] to-white/[0.03] my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${
                          step.actor === "You" ? "text-white" : "text-zinc-300"
                        }`}>
                          {step.actor}
                        </span>
                        {step.actor !== "You" && (
                          <span className="text-[10px] font-semibold text-zinc-600">AI Worker</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                        {step.action}
                      </p>
                      {step.connectors.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          {step.connectors.map((c) => (
                            <div
                              key={c}
                              className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5"
                            >
                              <BrandIcon id={c} className="h-3 w-3" />
                              <span className="text-[10px] font-semibold text-zinc-500">
                                {c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Outcome */}
              <div className="mt-4 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-5 py-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Result
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                      {currentCase.outcome}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Features Deep Dive
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function FeatureRow({
  title,
  desc,
  image,
  features,
  reversed,
}: {
  title: string;
  desc: string;
  image: string;
  features: { icon: typeof Sparkles; text: string }[];
  reversed?: boolean;
}) {
  const [revealRef, revealVisible] = useScrollReveal();

  return (
    <div
      ref={revealRef}
      className={`flex flex-col gap-12 lg:gap-20 ${
        reversed ? "lg:flex-row-reverse" : "lg:flex-row"
      } items-center`}
    >
      {/* Text */}
      <div
        className={`flex-1 transition-all duration-700 ${
          revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">{desc}</p>
        <div className="mt-8 space-y-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.text}
                className={`flex items-start gap-3 transition-all duration-500 ${
                  revealVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                }`}
                style={{ transitionDelay: `${i * 100 + 300}ms` }}
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05]">
                  <Icon size={13} className="text-zinc-400" />
                </div>
                <span className="text-sm text-zinc-300">{f.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image */}
      <div
        className={`flex-1 transition-all duration-700 ${
          revealVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        }`}
        style={{ transitionDelay: "200ms" }}
      >
        <div className="screenshot-tilt">
          <div className="screenshot-tilt-inner overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/50 shadow-2xl shadow-black/30">
            <img
              src={image}
              alt={title}
              className="w-full h-auto object-cover object-top"
              style={{ aspectRatio: "16/10" }}
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesDeepDive() {
  return (
    <section className="relative py-32">
      <div className="mx-auto max-w-7xl space-y-32 px-6 lg:px-8">
        <FeatureRow
          title="Chat naturally. Get things done."
          desc="FounderOS doesn't just answer questions â€” it understands your business, searches your knowledge base, and takes real action. No prompts to memorize, no workflows to build."
          image="/marketing/ai-conversation.png"
          features={[
            { icon: Search, text: "Searches your entire business knowledge base automatically" },
            { icon: Brain, text: "Understands context from previous conversations and decisions" },
            { icon: Zap, text: "Seamlessly transitions from asking to doing â€” no mode switching" },
            { icon: FileText, text: "Creates documents, analyses, and reports from natural conversation" },
          ]}
        />

        <FeatureRow
          title="Task management that works for you"
          desc="Delegate complex work in plain English. FounderOS breaks it down, executes step by step, and brings polished results back for your review â€” all visible in real-time."
          image="/marketing/work-dashboard.png"
          features={[
            { icon: Workflow, text: "Multi-step task execution with live progress updates" },
            { icon: Users, text: "Coordinates multi-step work automatically" },
            { icon: Shield, text: "Built-in approval gates for sensitive actions" },
            { icon: Clock, text: "Full history of what was done and why" },
          ]}
          reversed
        />

        <FeatureRow
          title="A memory for your entire business"
          desc="Library isn't a file cabinet â€” it's a searchable knowledge base that grows with your business. Every document, decision, and insight is organized and connected."
          image="/marketing/library-dashboard.png"
          features={[
            { icon: Search, text: "Search across everything your business knows" },
            { icon: Layers, text: "Automatic organization and relationship mapping" },
            { icon: Globe, text: "Pulls in knowledge from Gmail, Drive, Docs, and Sheets" },
            { icon: Lock, text: "Completely private â€” your data stays in your workspace" },
          ]}
        />
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Comparison Section
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function ComparisonSection() {
  const [revealRef, revealVisible] = useScrollReveal();

  const competitors = [
    { name: "FounderOS", featured: true },
    { name: "Hiring an EA", featured: false },
    { name: "Zapier + ChatGPT", featured: false },
    { name: "Single-purpose AI tools", featured: false },
  ];

  const features = [
    {
      label: "Natural language delegation",
      values: [true, true, false, "Limited"],
    },
    {
      label: "Multi-step task execution",
      values: [true, true, "Manual setup", false],
    },
    {
      label: "Persistent business memory",
      values: [true, "Partial", false, "Docs only"],
    },
    {
      label: "Connected integrations",
      values: ["8 native", "Manual", "5,000+ (no AI)", "Limited"],
    },
    {
      label: "Built-in approval gates",
      values: [true, "Informal", false, false],
    },
    {
      label: "24/7 availability",
      values: [true, false, true, true],
    },
    {
      label: "Specialized AI capabilities",
      values: ["Built-in", false, false, false],
    },
    {
      label: "Cost",
      values: ["From $0/mo", "$3-6k/mo", "$60+/mo", "$10/mo"],
    },
  ];

  function renderCell(value: boolean | string) {
    if (value === true) {
      return (
        <div className="flex items-center justify-center">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
            <Check size={12} className="text-emerald-400" />
          </div>
        </div>
      );
    }
    if (value === false) {
      return (
        <div className="flex items-center justify-center">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.04]">
            <X size={12} className="text-zinc-600" />
          </div>
        </div>
      );
    }
    return (
      <span className="text-xs font-medium text-zinc-400 text-center block">{value}</span>
    );
  }

  return (
    <section className="relative py-32 border-t border-white/[0.04]">
      <div className="grid-bg-fine absolute inset-0" />

      <div ref={revealRef} className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8">
        <div
          className={`mb-16 text-center transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Why FounderOS
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            One platform{" "}
            <span className="text-zinc-500">instead of twelve.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-zinc-400">
            See how FounderOS compares to the alternatives founders typically cobble together.
          </p>
        </div>

        {/* Comparison table */}
        <div
          className={`overflow-x-auto transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="min-w-[640px]">
            {/* Header row */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              <div /> {/* Empty first column */}
              {competitors.map((comp) => (
                <div
                  key={comp.name}
                  className={`text-center rounded-t-xl px-3 py-3 ${
                    comp.featured
                      ? "bg-white/[0.06] border border-b-0 border-white/[0.1] comparison-featured"
                      : ""
                  }`}
                >
                  <p className={`text-xs font-bold ${
                    comp.featured ? "text-white" : "text-zinc-500"
                  }`}>
                    {comp.name}
                  </p>
                  {comp.featured && (
                    <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-300">
                      You are here
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Feature rows */}
            {features.map((feature, fi) => (
              <div
                key={feature.label}
                className={`grid grid-cols-5 gap-2 transition-all duration-500 ${
                  revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${fi * 60 + 300}ms` }}
              >
                {/* Feature label */}
                <div className="flex items-center px-3 py-3">
                  <span className="text-xs font-medium text-zinc-400">
                    {feature.label}
                  </span>
                </div>

                {/* Values */}
                {feature.values.map((val, vi) => (
                  <div
                    key={`${feature.label}-${vi}`}
                    className={`flex items-center justify-center px-3 py-3 ${
                      vi === 0
                        ? "bg-white/[0.04] border-x border-white/[0.06]"
                        : fi % 2 === 0
                        ? "bg-white/[0.01]"
                        : ""
                    } ${
                      fi === features.length - 1 && vi === 0
                        ? "rounded-b-xl border-b border-white/[0.06]"
                        : ""
                    }`}
                  >
                    {renderCell(val)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Testimonials
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function TestimonialsSection() {
  const [revealRef, revealVisible] = useScrollReveal();

  const testimonials = [
    {
      quote:
        "FounderOS replaced my project manager, my executive assistant, and half my morning routine. I just tell it what I need and it happens.",
      name: "Alex Rivera",
      title: "CEO, Meridian Labs",
      initials: "AR",
    },
    {
      quote:
        "The Library feature alone saved me hours every week. I can ask 'what did we decide about pricing?' and get an instant, sourced answer.",
      name: "Sarah Chen",
      title: "Founder, Luma Health",
      initials: "SC",
    },
    {
      quote:
        "I was skeptical about AI replacing workflows. But FounderOS doesn't replace â€” it amplifies. I'm running a 10-person operation solo.",
      name: "Marcus Okonkwo",
      title: "Founder, Nexus Capital",
      initials: "MO",
    },
  ];

  return (
    <section className="relative py-32 border-t border-white/[0.04]">
      <div className="radial-glow absolute inset-0 pointer-events-none" />

      <div ref={revealRef} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={`mb-16 text-center transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            From founders like you
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Built for founders who{" "}
            <span className="text-zinc-500">do it all.</span>
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-500 glass-dark-hover ${
                revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 150 + 200}ms` }}
            >
              {/* Stars */}
              <div className="mb-6 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className="fill-zinc-400 text-zinc-400"
                  />
                ))}
              </div>

              <p className="text-sm leading-relaxed text-zinc-300 italic">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="mt-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-zinc-400">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Pricing
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function PricingSection() {
  const [revealRef, revealVisible] = useScrollReveal();

  const plans = [
    {
      name: "Starter",
      price: "Free",
      period: "",
      desc: "For founders exploring AI-powered workflows.",
      features: [
        "1 workspace",
        "Full AI capabilities",
        "50 tasks per month",
        "Basic Library (500 items)",
        "Community support",
      ],
      cta: "Get started free",
      featured: false,
    },
    {
      name: "Pro",
      price: "$49",
      period: "/month",
      desc: "For founders running their business with AI.",
      features: [
        "1 workspace",
        "Unlimited AI tasks",
        "Unlimited Library",
        "All integrations (Gmail, Drive, GitHub, Vercel)",
        "Scheduled automations",
        "Priority support",
        "Custom review rules",
      ],
      cta: "Start 14-day trial",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      desc: "For teams and organizations.",
      features: [
        "Multiple workspaces",
        "Custom AI configurations",
        "Advanced security & compliance",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantee",
      ],
      cta: "Contact sales",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-32 border-t border-white/[0.04]">
      <div className="grid-bg-fine absolute inset-0" />

      <div ref={revealRef} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={`mb-16 text-center transition-all duration-700 ${
            revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Pricing
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Start free.{" "}
            <span className="text-zinc-500">Scale when you&apos;re ready.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-zinc-400">
            No credit card required. Get started in seconds and upgrade when FounderOS
            becomes essential to your workflow.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 transition-all duration-500 ${
                plan.featured
                  ? "border-white/20 bg-white/[0.05] glow-card"
                  : "border-white/[0.06] bg-white/[0.02] glass-dark-hover"
              } ${
                revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 150 + 200}ms` }}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
                  Most popular
                </div>
              )}

              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                )}
              </div>
              <p className="mt-3 text-sm text-zinc-400">{plan.desc}</p>

              <div className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-zinc-500" />
                    <span className="text-sm text-zinc-300">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/"
                className={`mt-8 block rounded-xl px-6 py-3 text-center text-sm font-bold transition ${
                  plan.featured
                    ? "bg-white text-black hover:bg-zinc-200"
                    : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   CTA Section
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function CTASection() {
  const [revealRef, revealVisible] = useScrollReveal();

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="mesh-gradient absolute inset-0" />
      <div className="grid-bg absolute inset-0" />

      <div
        ref={revealRef}
        className={`relative z-10 mx-auto max-w-3xl px-6 text-center transition-all duration-700 ${
          revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Ready to run your business{" "}
          <span className="gradient-text">with AI?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-zinc-400">
          Join founders who replaced chaos with clarity. Start for free, no
          credit card required.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="btn-shimmer group inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-bold text-black transition hover:opacity-90"
          >
            Get started for free
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-600">
          Free forever on Starter. Upgrade anytime.
        </p>
      </div>
    </section>
  );
}

/* â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
   Footer
   â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” */

function Footer() {
  const columns = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Integrations", href: "#" },
        { label: "Changelog", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "API Reference", href: "#" },
        { label: "Status", href: "#" },
        { label: "Community", href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
        { label: "Security", href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.04] py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight">FounderOS</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              The AI assistant that runs your business. Delegate anything,
              approve everything.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {col.title}
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  {col.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="text-sm text-zinc-400 transition hover:text-white"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/[0.04] pt-8 sm:flex-row">
          <p className="text-xs text-zinc-600">
            Â© {new Date().getFullYear()} FounderOS. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-zinc-600 transition hover:text-zinc-400">Twitter</a>
            <a href="#" className="text-xs text-zinc-600 transition hover:text-zinc-400">LinkedIn</a>
            <a href="#" className="text-xs text-zinc-600 transition hover:text-zinc-400">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
