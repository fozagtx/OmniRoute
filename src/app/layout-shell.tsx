"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import StatusBar from "./StatusBar";

export default function LayoutShell({
  children,
  rpcHost,
  buildTag,
}: {
  children: React.ReactNode;
  rpcHost: string;
  buildTag: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAccount();
  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => {
    if (!isDashboard && pathname === "/" && (status === "connected" || status === "reconnecting")) {
      router.replace("/dashboard");
    }
  }, [isDashboard, pathname, router, status]);

  return (
    <>
      {!isDashboard && <StatusBar />}
      {children}
      {!isDashboard && (
        <footer className="footer">
          <div className="footer__top">
            <div className="footer__brand">
              <span className="brand">
                <span className="brand__mark" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="3.5" cy="3.5" r="2" fill="#fff" />
                    <circle cx="12.5" cy="12.5" r="2" fill="#fff" />
                    <path
                      d="M3.5 5.5v2.5a3 3 0 0 0 3 3h3"
                      stroke="#fff"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="brand__name">OmniRoute</span>
              </span>
              <p className="footer__tagline">
                Stablecoin escrow settled against public reference rates — no
                private desk, no manual release.
              </p>
            </div>

            <nav className="footer__col" aria-label="Product">
              <span className="footer__head">Product</span>
              <a href="/#how">How it works</a>
              <a href="/#compare">Compare</a>
              <a href="/#faq">FAQ</a>
            </nav>

            <nav className="footer__col" aria-label="Network">
              <span className="footer__head">Network</span>
              <a
                href="https://shannon-explorer.somnia.network"
                target="_blank"
                rel="noopener noreferrer"
              >
                Block explorer ↗
              </a>
              <a
                href="https://somnia.network"
                target="_blank"
                rel="noopener noreferrer"
              >
                Somnia ↗
              </a>
              <span className="footer__muted">chain 50312 · testnet</span>
              <span className="footer__muted">rpc {rpcHost}</span>
            </nav>
          </div>

          <div className="footer__bottom">
            <span>© 2026 OmniRoute</span>
            <span className="footer__muted">
              build {buildTag} · somnia agents
            </span>
          </div>
        </footer>
      )}
    </>
  );
}
