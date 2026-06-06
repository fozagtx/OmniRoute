import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Somnia Clip Bounties",
  description: "Fund YouTube clip bounties, verify views with Somnia Agents, and pay clippers from escrow.",
  openGraph: {
    title: "Somnia Clip Bounties",
    description: "Fund YouTube clip bounties, verify views with Somnia Agents, and pay clippers from escrow.",
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
