import type { Metadata } from "next";
import "./marketing.css";

export const metadata: Metadata = {
  title: "FounderOS — Your AI Business Operating System",
  description:
    "FounderOS gives founders an AI-native workspace to ask, delegate, review, and reuse business knowledge. One calm place to run your entire business.",
  openGraph: {
    title: "FounderOS — Your AI Business Operating System",
    description:
      "FounderOS gives founders an AI-native workspace to ask, delegate, review, and reuse business knowledge.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FounderOS — Your AI Business Operating System",
    description:
      "FounderOS gives founders an AI-native workspace to ask, delegate, review, and reuse business knowledge.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-black text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
