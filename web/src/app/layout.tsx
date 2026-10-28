import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { KeyRound, Sparkles } from "lucide-react";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Field Guides",
  description: "How long will it take to get your OAuth app approved? Guides for agent builders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-lg bg-ink text-bg">
                <KeyRound className="size-4" />
              </span>
              OAuth Field Guides
            </Link>
            <Link
              href="/generate"
              className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-bg hover:opacity-90"
            >
              <Sparkles className="size-3.5" /> Generate a guide
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
          Guides mark every claim as <b>tested</b>, <b>sourced</b> or <b>inferred</b>. Provider policies change — check the linked sources before you submit for review.
        </footer>
      </body>
    </html>
  );
}
