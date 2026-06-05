import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "FounderOS Privacy Policy",
  description: "FounderOS privacy policy for workspace context, connected services, approvals, and model access.",
};

const sections = [
  {
    title: "What FounderOS stores",
    body: "FounderOS stores account details, workspace settings, conversations, Work items, Library records, Schedules, approvals, and connector configuration needed to operate the workspace.",
  },
  {
    title: "Connected services",
    body: "When you connect services such as Google Workspace, GitHub, Vercel, or Stripe-derived finance context, FounderOS uses the access you grant to read or prepare the work you request. Sensitive actions remain approval-gated.",
  },
  {
    title: "Model and local runtime access",
    body: "FounderOS can use local OpenCode, your own keys, or managed model access depending on setup. The product should avoid exposing provider and routing details to founders, but privacy rules still apply before context is used.",
  },
  {
    title: "Approvals",
    body: "FounderOS asks for review before public publishing, changing live assets, deleting important data, spending money, sending email, posting externally, or contacting people outside the business.",
  },
  {
    title: "Your controls",
    body: "You can manage connected services, remembered details, human team settings, account deletion, and workspace rules from Settings. If this policy needs exact production legal language, replace this page before launch.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="How FounderOS handles workspace context, connected services, model access, and approval-gated work." sections={sections} />
  );
}

function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: Array<{ title: string; body: string }> }) {
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
          <Link href="/subscription" className="text-sm font-semibold text-zinc-600 hover:text-zinc-950">Subscription</Link>
        </nav>
      </header>
      <section className="mx-auto max-w-[980px] px-5 py-14 sm:px-8 sm:py-20">
        <Link href="/marketing" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
          <ArrowLeft size={15} />
          Marketing
        </Link>
        <p className="mt-8 text-sm font-medium text-zinc-500">Last updated June 4, 2026</p>
        <h1 className="mt-3 text-5xl font-bold leading-tight">{title}</h1>
        <p className="mt-5 text-lg leading-8 text-zinc-600">{intro}</p>
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
