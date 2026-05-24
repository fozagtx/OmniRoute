import type { Metadata } from "next";
import Providers from "./providers";
import LayoutShell from "./layout-shell";
import "./globals.css";

const SOMNIA_RPC = process.env.NEXT_PUBLIC_SOMNIA_RPC;

if (!SOMNIA_RPC) {
  throw new Error("NEXT_PUBLIC_SOMNIA_RPC is required");
}

const RPC_HOST = SOMNIA_RPC.replace(/^https?:\/\//, "").replace(/\/$/, "");

const BUILD_TAG = process.env.NODE_ENV === "production" ? "prod" : "dev";

export const metadata: Metadata = {
  title: "OmniRoute on Somnia",
  description:
    "Stablecoin escrow settlement on Somnia. Agents check public reference rates, then release or refund ERC-20 funds.",
  openGraph: {
    title: "OmniRoute",
    description: "Stablecoin settlement with validator-verified reference rates",
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
        <Providers>
          <LayoutShell
            rpcHost={RPC_HOST}
            buildTag={BUILD_TAG}
          >
            {children}
          </LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
