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
  BarChart3,
  Clock,
  Layers,
  Search,
  Bot,
  Workflow,
  Star,
} from "lucide-react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Scroll reveal hook
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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

  return { ref, isVisible };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Typewriter effect
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Main Marketing Page
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
      <AIWorkersSection />
      <HowItWorks />
      <FeaturesDeepDive />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Navbar
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
        <Link href="/marketing" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-bold text-sm transition-transform group-hover:scale-105">
            F
          </div>
          <span className="text-base font-bold tracking-tight">FounderOS</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-zinc-400 transition hover:text-white">
            Features
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Hero Section
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
          <span className="block">Your AI-powered</span>
          <span className="gradient-text block">business operating</span>
          <span className="block">system</span>
        </h1>

        {/* Subtitle */}
        <p className="reveal-up stagger-3 mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl" style={{ opacity: 0 }}>
          FounderOS gives you an AI workforce that thinks, creates, and executes
          across your entire business. One calm workspace to ask, delegate,
          review, and build — powered by intelligent agents.
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
                alt="FounderOS Dashboard — AI business workspace with chat interface, task management, and smart suggestions"
                className="w-full"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Logo Bar / Social Proof
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function LogoBar() {
  const reveal = useScrollReveal();

  const integrations = [
    "Gmail", "Google Drive", "Slack", "Notion", "Stripe", "GitHub", "Vercel", "Calendar",
  ];

  return (
    <section className="relative border-t border-b border-white/[0.04] py-16 overflow-hidden">
      <div
        ref={reveal.ref}
        className={`mx-auto max-w-7xl px-6 text-center transition-all duration-700 ${
          reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <p className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          Connects with the tools you already use
        </p>

        {/* Integration marquee */}
        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10" />
          <div className="flex animate-marquee whitespace-nowrap">
            {[...integrations, ...integrations].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="mx-6 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5"
              >
                <Globe size={14} className="text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-400">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { value: "5", label: "AI Workers" },
            { value: "∞", label: "Tasks delegated" },
            { value: "24/7", label: "Always running" },
            { value: "< 1min", label: "Average response" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`transition-all duration-700 ${
                reveal.isVisible
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Product Overview — Bento Grid
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ProductOverview() {
  const reveal = useScrollReveal();

  const surfaces = [
    {
      icon: Home,
      title: "Home",
      desc: "Your universal command surface. Ask questions, start tasks, and get AI-powered suggestions — all from one intelligent prompt.",
      image: "/marketing/hero-dashboard.png",
      span: "col-span-2 row-span-2",
      tag: "Command Center",
    },
    {
      icon: BriefcaseBusiness,
      title: "Work",
      desc: "See what's active, what needs review, and what's done. Your AI workers report progress in real-time.",
      image: "/marketing/work-dashboard.png",
      span: "col-span-1 row-span-1",
      tag: "Task Flow",
    },
    {
      icon: Library,
      title: "Library",
      desc: "Queryable business knowledge — search, summarize, and reuse everything your business knows.",
      image: "/marketing/library-dashboard.png",
      span: "col-span-1 row-span-1",
      tag: "Knowledge Base",
    },
    {
      icon: CalendarClock,
      title: "Schedules",
      desc: "Recurring work in plain language. \"Send priorities every morning\" — that simple.",
      image: "/marketing/schedules-dashboard.png",
      span: "col-span-1 row-span-1",
      tag: "Automation",
    },
    {
      icon: Settings,
      title: "Settings",
      desc: "Connected services, review rules, spending limits, and preferences. Control your AI workforce.",
      image: null,
      span: "col-span-1 row-span-1",
      tag: "Configuration",
    },
  ];

  return (
    <section id="features" className="relative py-32">
      <div className="radial-glow absolute inset-0 pointer-events-none" />

      <div
        ref={reveal.ref}
        className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8"
      >
        {/* Section header */}
        <div
          className={`mb-16 max-w-2xl transition-all duration-700 ${
            reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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
            FounderOS organizes your AI workspace into five intuitive surfaces —
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
                  reveal.isVisible
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AI Workers Section
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function AIWorkersSection() {
  const reveal = useScrollReveal();

  const workers = [
    {
      name: "Orion",
      role: "Chief of Staff",
      desc: "Coordinates all work, routes tasks to the right specialist, and keeps you informed.",
      icon: Brain,
    },
    {
      name: "Atlas",
      role: "Systems Lead",
      desc: "Builds, deploys, and manages technical infrastructure and integrations.",
      icon: Layers,
    },
    {
      name: "Nova",
      role: "Preview Designer",
      desc: "Creates visual previews, designs, and presentation-ready outputs.",
      icon: Sparkles,
    },
    {
      name: "Sage",
      role: "Growth Lead",
      desc: "Analyzes metrics, writes marketing copy, and identifies growth opportunities.",
      icon: BarChart3,
    },
    {
      name: "Vigil",
      role: "Operations Steward",
      desc: "Monitors schedules, manages recurring tasks, and ensures nothing falls through.",
      icon: Shield,
    },
  ];

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="grid-bg-fine absolute inset-0" />

      <div ref={reveal.ref} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div
          className={`mb-20 text-center transition-all duration-700 ${
            reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Your AI workforce
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Meet your team.{" "}
            <span className="text-zinc-500">They never sleep.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Five specialized AI workers handle everything from strategy to execution.
            They coordinate, create, and deliver — all under your supervision.
          </p>
        </div>

        {/* Orbital visualization + worker cards */}
        <div className="flex flex-col items-center gap-16 lg:flex-row lg:gap-20">
          {/* Left: Orbital visualization */}
          <div
            className={`relative flex shrink-0 items-center justify-center transition-all duration-1000 ${
              reveal.isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
            style={{ width: 380, height: 380 }}
          >
            {/* Orbital rings */}
            <div className="orbit-ring absolute inset-0 rounded-full border border-white/[0.04]" />
            <div
              className="orbit-ring-reverse absolute rounded-full border border-white/[0.03]"
              style={{ inset: "40px" }}
            />
            <div
              className="orbit-ring absolute rounded-full border border-dashed border-white/[0.03]"
              style={{ inset: "80px" }}
            />

            {/* Pulse rings */}
            <div className="pulse-ring absolute rounded-full border border-white/[0.06]" style={{ inset: "100px" }} />
            <div className="pulse-ring-delayed absolute rounded-full border border-white/[0.04]" style={{ inset: "90px" }} />
            <div className="pulse-ring-delayed-2 absolute rounded-full border border-white/[0.03]" style={{ inset: "80px" }} />

            {/* Center node */}
            <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm">
              <div className="text-center">
                <p className="text-lg font-extrabold">F</p>
                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">
                  You
                </p>
              </div>
            </div>

            {/* Orbiting worker nodes */}
            {workers.map((worker, i) => {
              const angle = (i * 72 - 90) * (Math.PI / 180);
              const radius = 150;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const Icon = worker.icon;

              return (
                <div
                  key={worker.name}
                  className={`absolute flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 backdrop-blur-sm transition-all duration-700 float-badge ${
                    reveal.isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
                  }`}
                  style={{
                    left: `calc(50% + ${x}px - 24px)`,
                    top: `calc(50% + ${y}px - 24px)`,
                    transitionDelay: `${i * 150 + 300}ms`,
                    animationDelay: `${i * 0.6}s`,
                  }}
                  title={`${worker.name} — ${worker.role}`}
                >
                  <Icon size={18} className="text-zinc-300" />
                </div>
              );
            })}

            {/* Connection lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 380 380">
              {workers.map((worker, i) => {
                const angle = (i * 72 - 90) * (Math.PI / 180);
                const radius = 150;
                const x = 190 + Math.cos(angle) * radius;
                const y = 190 + Math.sin(angle) * radius;

                return (
                  <line
                    key={worker.name}
                    x1="190" y1="190"
                    x2={x} y2={y}
                    className="draw-line"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>

          {/* Right: Worker cards */}
          <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {workers.map((worker, i) => {
              const Icon = worker.icon;

              return (
                <div
                  key={worker.name}
                  className={`group flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-500 glass-dark-hover ${
                    reveal.isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                  }`}
                  style={{ transitionDelay: `${i * 100 + 200}ms` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
                    <Icon size={18} className="text-zinc-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{worker.name}</p>
                      <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                        {worker.role}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {worker.desc}
                    </p>
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   How It Works
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function HowItWorks() {
  const reveal = useScrollReveal();

  const steps = [
    {
      step: "01",
      title: "Ask or delegate",
      desc: "Type what you need in plain language. Ask a question, start a task, or give direction — FounderOS understands your intent.",
      icon: MessageSquare,
      example: '"Create a competitive analysis for our Q4 strategy"',
    },
    {
      step: "02",
      title: "AI workers execute",
      desc: "Your AI workforce takes over. They coordinate, research, create, and build — reporting progress in real-time so you stay informed.",
      icon: Bot,
      example: "Workers research competitors, analyze data, draft the report",
    },
    {
      step: "03",
      title: "Review and approve",
      desc: "FounderOS asks before publishing, spending, or contacting anyone externally. You stay in control while your AI team does the heavy lifting.",
      icon: CheckCircle2,
      example: "Review the draft, approve or request changes",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-32">
      <div className="radial-glow-top absolute inset-0 pointer-events-none" />

      <div ref={reveal.ref} className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8">
        <div
          className={`mb-20 text-center transition-all duration-700 ${
            reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Simple by design
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Three steps.{" "}
            <span className="text-zinc-500">Zero complexity.</span>
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
                    reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Features Deep Dive
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
  const reveal = useScrollReveal();

  return (
    <div
      ref={reveal.ref}
      className={`flex flex-col gap-12 lg:gap-20 ${
        reversed ? "lg:flex-row-reverse" : "lg:flex-row"
      } items-center`}
    >
      {/* Text */}
      <div
        className={`flex-1 transition-all duration-700 ${
          reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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
                  reveal.isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
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
          reveal.isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        }`}
        style={{ transitionDelay: "200ms" }}
      >
        <div className="screenshot-tilt">
          <div className="screenshot-tilt-inner overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/50 shadow-2xl shadow-black/30">
            <img
              src={image}
              alt={title}
              className="w-full"
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
          title="Intelligent conversations that get things done"
          desc="FounderOS doesn't just answer questions — it understands context, searches your business knowledge, and takes action. Chat naturally, and your AI workforce handles the rest."
          image="/marketing/ai-conversation.png"
          features={[
            { icon: Search, text: "Searches your entire business knowledge base automatically" },
            { icon: Brain, text: "Understands context from previous conversations and decisions" },
            { icon: Zap, text: "Seamlessly transitions from asking to doing — no mode switching" },
            { icon: FileText, text: "Creates documents, analyses, and reports from natural conversation" },
          ]}
        />

        <FeatureRow
          title="Real-time task management, handled by AI"
          desc="Delegate complex work in plain English. Your AI workers break down tasks, execute step by step, and bring results back for your review — all visible in real-time."
          image="/marketing/work-dashboard.png"
          features={[
            { icon: Workflow, text: "Multi-step task execution with live progress updates" },
            { icon: Users, text: "AI workers coordinate and hand off work automatically" },
            { icon: Shield, text: "Built-in approval gates for sensitive actions" },
            { icon: Clock, text: "Full history of what was done and why" },
          ]}
          reversed
        />

        <FeatureRow
          title="Your business memory, always accessible"
          desc="Library isn't a file cabinet — it's a living, queryable knowledge base. Every document, decision, research note, and output is searchable and connected."
          image="/marketing/library-dashboard.png"
          features={[
            { icon: Search, text: "Semantic search across all business knowledge" },
            { icon: Layers, text: "Automatic categorization and relationship mapping" },
            { icon: Globe, text: "Ingests from Gmail, Drive, Slack, Notion, and more" },
            { icon: Lock, text: "Workspace-isolated — your data stays private" },
          ]}
        />
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Testimonials
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function TestimonialsSection() {
  const reveal = useScrollReveal();

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
        "I was skeptical about AI replacing workflows. But FounderOS doesn't replace — it amplifies. I'm running a 10-person operation solo.",
      name: "Marcus Okonkwo",
      title: "Founder, Nexus Capital",
      initials: "MO",
    },
  ];

  return (
    <section className="relative py-32 border-t border-white/[0.04]">
      <div className="radial-glow absolute inset-0 pointer-events-none" />

      <div ref={reveal.ref} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={`mb-16 text-center transition-all duration-700 ${
            reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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
                reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Pricing
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PricingSection() {
  const reveal = useScrollReveal();

  const plans = [
    {
      name: "Starter",
      price: "Free",
      period: "",
      desc: "For founders exploring AI-powered workflows.",
      features: [
        "1 workspace",
        "5 AI workers",
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
        "5 AI workers, unlimited tasks",
        "Unlimited Library",
        "All integrations (Gmail, Slack, etc.)",
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
        "Custom AI worker configurations",
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

      <div ref={reveal.ref} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={`mb-16 text-center transition-all duration-700 ${
            reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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
                reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CTA Section
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CTASection() {
  const reveal = useScrollReveal();

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="mesh-gradient absolute inset-0" />
      <div className="grid-bg absolute inset-0" />

      <div
        ref={reveal.ref}
        className={`relative z-10 mx-auto max-w-3xl px-6 text-center transition-all duration-700 ${
          reveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Footer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-bold text-sm">
                F
              </div>
              <span className="text-base font-bold tracking-tight">FounderOS</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              The AI-native operating system for founders. One calm place to run
              your entire business.
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
            © {new Date().getFullYear()} FounderOS. All rights reserved.
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
