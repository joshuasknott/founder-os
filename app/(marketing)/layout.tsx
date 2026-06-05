import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./marketing.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FounderOS - One workspace for anything your business needs",
  description:
    "FounderOS is an open-source, AI-native workspace that connects your context, tools, models, and agents so you can run tasks, workflows, or an entire business.",
  openGraph: {
    title: "FounderOS - One workspace for anything your business needs",
    description:
      "Connect your tools, context, models, and keys in one adaptive workspace for agentic work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FounderOS - One workspace for anything your business needs",
    description:
      "An open-source, AI-native workspace for tasks, workflows, knowledge, automations, and transparent orchestration.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-[#fbfaf7] text-zinc-950 font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
