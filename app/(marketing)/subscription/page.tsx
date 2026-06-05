import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "FounderOS Subscription",
  description: "FounderOS subscription options for open-source, managed, and team workspaces.",
};

const plans = [
  {
    name: "Open source",
    price: "$0",
    summary: "Use FounderOS locally, bring your own keys, and connect the services you configure.",
    features: [
      "Home, Work, Library, Schedules, and Settings",
      "Local OpenCode support when configured on this computer",
      "Bring your own model and provider keys",
      "Approval gates for publishing, sending, spending, and deletion",
    ],
  },
  {
    name: "Managed",
    price: "$29 / month",
    summary: "A hosted FounderOS workspace for founders who want the product without running the machinery.",
    features: [
      "Hosted model access and reliability",
      "Connector setup guidance for Google Workspace, GitHub, Vercel, and finance context",
      "Managed updates and priority fixes",
      "Private previews and approval-first work runs",
    ],
    featured: true,
  },
  {
    name: "Team",
    price: "Custom",
    summary: "Shared operating context, rules, and review controls for small teams.",
    features: [
      "Team workspaces and role-aware settings",
      "Advanced review rules and spending limits",
      "Custom connector support",
      "Private onboarding and implementation help",
    ],
  },
];

const faqs = [
  {
    q: "Can I self-host FounderOS?",
    a: "Yes. The open-source path is designed for founders who want to run the workspace locally or on their own infrastructure and bring their own keys.",
  },
  {
    q: "What does the managed subscription add?",
    a: "Managed FounderOS adds hosted reliability, model access, connector setup support, and a subscription-backed operating path so you do not have to maintain the runtime yourself.",
  },
  {
    q: "Does FounderOS spend money or publish without review?",
    a: "No. Sensitive actions such as sending external messages, publishing publicly, spending money, deleting important data, or changing live assets are approval-gated.",
  },
  {
    q: "How does OpenCode fit in?",
    a: "FounderOS uses OpenCode as the preferred local build engine when this computer is configured and authenticated. Managed plans can reduce how much setup the founder has to maintain.",
  },
];

export default function SubscriptionPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-zinc-950">
      <PageHeader />
      <section className="border-b border-zinc-950/[0.06] bg-white">
        <div className="mx-auto grid max-w-[1480px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-20">
          <div>
            <Link href="/marketing" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
              <ArrowLeft size={15} />
              Marketing
            </Link>
            <h1 className="mt-8 text-5xl font-bold leading-tight text-zinc-950 sm:text-6xl">Subscription that matches how you want to run FounderOS.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
              Start with the open-source workspace. Upgrade when you want hosted model access, managed reliability, connector help, and fewer runtime details to maintain.
            </p>
          </div>
          <SubscriptionDemo />
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1480px] px-5 sm:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative overflow-hidden rounded-lg border p-6 shadow-[0_18px_65px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_95px_rgba(15,23,42,0.16)] ${plan.featured ? "border-zinc-950 bg-zinc-950 text-white lg:-mt-4 lg:pb-9" : "border-zinc-950/[0.08] bg-white text-zinc-950"}`}
              >
                {plan.featured && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(20,184,166,0.3),transparent_30%),radial-gradient(circle_at_90%_0%,rgba(245,158,11,0.24),transparent_36%)]" />
                )}
                <div className="relative z-10">
                  <div className="flex min-h-[92px] items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{plan.name}</p>
                      <p className={`mt-3 text-sm leading-6 ${plan.featured ? "text-zinc-200" : "text-zinc-600"}`}>{plan.summary}</p>
                    </div>
                    {plan.featured && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-950 shadow-sm">Best fit</span>}
                  </div>
                  <p className="mt-7 border-t border-current/10 pt-6 text-5xl font-bold tracking-tight">{plan.price}</p>
                  <ul className="mt-6 space-y-3.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className={`flex gap-2 text-sm leading-6 ${plan.featured ? "text-zinc-100" : "text-zinc-700"}`}>
                        <Check size={15} className={`mt-1 shrink-0 ${plan.featured ? "text-teal-300" : "text-teal-600"}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-950/[0.06] bg-white py-16">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-medium text-zinc-500">Billing notes</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-zinc-950">Built around control, not surprise usage.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="rounded-lg border border-zinc-950/[0.08] bg-[#fbfaf7] p-5">
                <h3 className="text-sm font-semibold text-zinc-950">{item.q}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-600">Ready to try the workspace?</p>
          <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white">
            Get started
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function SubscriptionDemo() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-950/[0.08] bg-white shadow-[0_24px_90px_rgba(15,23,42,0.08)]">
      <div className="border-b border-zinc-950/[0.06] bg-zinc-950 p-5 text-white">
        <p className="text-sm font-semibold">Managed workspace simulation</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">Model access, connectors, reliability, and approvals in one operating path.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {[
          { label: "Open source", value: "$0", note: "Self-managed" },
          { label: "Managed", value: "$29", note: "Hosted setup" },
          { label: "Team", value: "Custom", note: "Shared controls" },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border p-4 ${item.label === "Managed" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-950/[0.08] bg-[#fbfaf7] text-zinc-950"}`}>
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-5 text-3xl font-bold tracking-tight">{item.value}</p>
            <p className={`mt-1 text-xs font-medium ${item.label === "Managed" ? "text-zinc-300" : "text-zinc-500"}`}>{item.note}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-950/[0.06] p-5">
        <div className="space-y-2">
          {["Connect Google Workspace and GitHub", "Route build work through Codex or OpenCode", "Pause publish, send, spend, and delete actions for approval"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg border border-zinc-950/[0.07] bg-[#fbfaf7] px-3 py-2.5 text-sm text-zinc-700">
              <Check size={15} className="shrink-0 text-teal-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="border-b border-zinc-950/[0.06] bg-[#fbfaf7]/88 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/marketing" className="flex items-center gap-3" aria-label="FounderOS marketing home">
          <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-zinc-950/10 bg-white shadow-sm">
            <Image src="/marketing/founderos-mark-generated.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
          </span>
          <span className="text-xl font-bold text-zinc-950">FounderOS</span>
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-600">
          <Link href="/privacy" className="hover:text-zinc-950">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-950">Terms</Link>
        </div>
      </nav>
    </header>
  );
}
