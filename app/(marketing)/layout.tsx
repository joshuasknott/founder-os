import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./marketing.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FounderOS - One workspace to ask, delegate, review, and reuse context",
  description:
    "FounderOS is an open-source, AI-native workspace for a non-technical founder to use company knowledge, live services, and approvals in one calm operating layer.",
  openGraph: {
    title: "FounderOS - One workspace to ask, delegate, review, and reuse context",
    description:
      "Connect company knowledge, Google Workspace, GitHub, Vercel, local build support, and approval gates in one founder-facing workspace.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FounderOS - One workspace to ask, delegate, review, and reuse context",
    description:
      "An open-source, AI-native workspace for business context, visible work, recurring requests, and approval-gated action.",
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
