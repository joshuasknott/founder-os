import type { Metadata } from "next";
import ConvexClientProvider from "./providers";
import { Leftnav } from "@/components/layout/Leftnav";
import "./globals.css";

export const metadata: Metadata = {
  title: "FounderOS",
  description: "Your AI-native operating system",
};

export default function RootLayout({
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
        <ConvexClientProvider>
          {/* Animated Background Aura Layer */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 opacity-[0.85]">
            <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-amber-100/25 to-rose-100/20 blur-[130px] animate-float-1 animate-pulse-soft" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-gradient-to-br from-blue-50/35 to-indigo-100/25 blur-[140px] animate-float-2" />
            <div className="absolute top-[30%] right-[15%] w-[38vw] h-[38vw] rounded-full bg-gradient-to-br from-purple-50/15 to-sky-50/20 blur-[110px] opacity-70 animate-pulse-soft" />
          </div>

          {/* Interactive Layer Wrapper */}
          <div className="relative flex h-screen w-full overflow-hidden z-10">
            <Leftnav />
            <main className="flex flex-1 flex-col overflow-y-auto bg-transparent relative">
              {children}
            </main>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
