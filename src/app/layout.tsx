import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Somnia Market Console",
  description:
    "Create markets, stake positions, request resolution, and inspect resolver receipts on Somnia.",
  openGraph: {
    title: "Somnia Market Console",
    description: "Create markets, stake positions, request resolution, and inspect resolver receipts on Somnia.",
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
