"use client";

import Image from "next/image";
import { useWallet } from "@/lib/wallet";

export default function DashboardLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const { address, connect, disconnect, isConnected, isConnecting } = useWallet();
  const walletLabel = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : isConnecting ? "Connecting" : "Connect";

  return (
    <div className="dashboard-layout dashboard-layout--expanded">
      <aside className="sidebar">
        <a className="sidebar__brand" href="/" aria-label="Reel home">
          <span className="brand__mark" aria-hidden>
            <Image
              src="/brand/reel-logo.png"
              alt=""
              width={56}
              height={56}
              priority
            />
          </span>
          <span className="sidebar__brand-text">Reel</span>
        </a>

        <div className="sidebar__children">{sidebar}</div>

        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__wallet"
            aria-label={isConnected ? `Disconnect wallet ${walletLabel}` : "Connect wallet"}
            disabled={!isConnected && isConnecting}
            onClick={() => (isConnected ? disconnect() : void connect())}
          >
            <span className="sidebar__wallet-dot" data-connected={isConnected ? "true" : "false"} aria-hidden />
            <span className="sidebar__wallet-label">{walletLabel}</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>
    </div>
  );
}
