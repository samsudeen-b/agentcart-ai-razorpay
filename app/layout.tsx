import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentCart AI — Bounded Commerce Agent",
  description: "An explainable agentic commerce demo with product discovery, smart bundles, customer-gated payments, and a complete decision audit trail.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
