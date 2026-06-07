import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel",
  description: "Agents unlock escrow payments for clippers when public YouTube results are verified on-chain.",
  openGraph: {
    title: "Reel",
    description: "Agents unlock escrow payments for clippers when public YouTube results are verified on-chain.",
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
