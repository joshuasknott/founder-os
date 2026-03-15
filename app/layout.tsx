import type { Metadata } from "next";
import ConvexClientProvider from "./providers";
import { Leftnav } from "@/components/layout/Leftnav";
import { Rightnav } from "@/components/layout/Rightnav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Founder OS",
  description: "Principal Command Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ConvexClientProvider>
          <div className="flex h-screen w-full overflow-hidden bg-white text-zinc-950 font-sans">
            <Leftnav />
            <main className="flex flex-1 flex-col overflow-y-auto">
              {children}
            </main>
            <Rightnav />
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
