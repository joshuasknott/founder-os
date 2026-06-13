"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const githubUrl = "https://github.com/joshuasknott/founder-os";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#workflow" },
  { label: "Integrations", href: "#integrations" },
  { label: "Trust", href: "#trust" },
  { label: "Privacy", href: "/privacy" },
];

function LogoMark() {
  return (
    <span aria-hidden="true" className="marketing-logo-mark inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-zinc-950/10 bg-white shadow-sm" />
  );
}

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-950/[0.06] bg-[#fbfaf7]/90 backdrop-blur-xl">
      <nav aria-label="Primary navigation" className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <a href="/marketing" className="flex items-center gap-3" aria-label="FounderOS marketing home">
          <LogoMark />
          <span className="text-xl font-bold text-zinc-950">FounderOS</span>
        </a>

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
          <Link href="/" prefetch={false} className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-white hover:text-zinc-950">
            Log in
          </Link>
          <Link href="/" prefetch={false} className="rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800">
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-950/10 bg-white text-zinc-950 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {mobileOpen && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-zinc-950/[0.06] bg-[#fbfaf7] px-5 py-5 lg:hidden">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md py-2 text-sm font-medium text-zinc-700"
              >
                {item.label}
              </a>
            ))}
            <Link href="/" prefetch={false} className="rounded-lg border border-zinc-950/10 bg-white px-4 py-2 text-center text-sm font-semibold">
              Log in
            </Link>
            <Link href="/" prefetch={false} className="rounded-lg bg-zinc-950 px-4 py-2 text-center text-sm font-semibold text-white">
              Get started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
