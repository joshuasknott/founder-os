import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./providers";
import { Leftnav } from "@/components/layout/Leftnav";
import "./globals.css";

export const metadata: Metadata = {
  title: "FounderOS",
  description: "AI business workspace for a founder and one business",
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full overflow-hidden bg-surface text-text-primary font-sans antialiased">
        <ClerkProvider>
          <ConvexClientProvider>
            <div className="relative z-10 flex h-screen w-full flex-col overflow-hidden lg:flex-row">
              <Leftnav />
              <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface">
                {children}
              </main>
            </div>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
