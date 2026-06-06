import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Somnia Markets",
  description:
    "Create source-bound markets, stake STT, request Somnia agent resolution, and claim payouts on-chain.",
  openGraph: {
    title: "Somnia Markets",
    description: "Create source-bound markets, stake STT, request Somnia agent resolution, and claim payouts on-chain.",
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
