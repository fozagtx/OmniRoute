import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel",
  description: "Fund creator bounties, verify public metrics with Somnia Agents, and pay creators from escrow.",
  openGraph: {
    title: "Reel",
    description: "Fund creator bounties, verify public metrics with Somnia Agents, and pay creators from escrow.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
