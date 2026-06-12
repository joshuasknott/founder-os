import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "FounderOS Terms",
  description: "FounderOS terms covering subscriptions, acceptable use, connected services, and approvals.",
};

const sections = [
  {
    title: "Use of FounderOS",
    body: "FounderOS helps founders ask, decide, delegate, review, and reuse company knowledge. You are responsible for the requests you submit, the services you connect, and the outputs you approve.",
  },
  {
    title: "Subscriptions",
    body: "Managed subscriptions may include hosted reliability, runtime support, connector setup support, and product updates. Open-source use remains available for self-managed deployments.",
  },
  {
    title: "Connected tools",
    body: "FounderOS may prepare work using connected services. External changes, sending, publishing, spending, deletion, or live updates require explicit approval where supported by the product boundary.",
  },
  {
    title: "Outputs",
    body: "FounderOS can draft documents, previews, plans, summaries, schedules, and Library records. You should review important business, financial, legal, customer-facing, or operational outputs before relying on them.",
  },
  {
    title: "Placeholder language",
    body: "This page is an implementation-ready starting point for launch content. Replace it with reviewed legal terms before using FounderOS as a public commercial service.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-zinc-950">
      <header className="border-b border-zinc-950/[0.06] bg-white">
        <nav className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/marketing" className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-zinc-950/10 bg-white shadow-sm">
              <Image src="/marketing/founderos-mark-generated.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
            </span>
            <span className="text-xl font-bold">FounderOS</span>
          </Link>
          <Link href="/privacy" className="text-sm font-semibold text-zinc-600 hover:text-zinc-950">Privacy</Link>
        </nav>
      </header>
      <section className="mx-auto max-w-[980px] px-5 py-14 sm:px-8 sm:py-20">
        <Link href="/marketing" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
          <ArrowLeft size={15} />
          Marketing
        </Link>
        <p className="mt-8 text-sm font-medium text-zinc-500">Last updated June 4, 2026</p>
        <h1 className="mt-3 text-5xl font-bold leading-tight">Terms</h1>
        <p className="mt-5 text-lg leading-8 text-zinc-600">
          Practical terms for FounderOS subscriptions, connected services, review gates, and founder responsibility.
        </p>
        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-zinc-950/[0.08] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-950">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
