"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { useWallet } from "@/lib/wallet";

export default function DashboardLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { address, connect, disconnect, error, isConnected, isConnecting } = useWallet();
  const walletLabel = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Wallet";

  return (
    <div className={`dashboard-layout ${open ? "dashboard-layout--expanded" : "dashboard-layout--collapsed"}`}>
      <aside className={`sidebar ${open ? "sidebar--expanded" : "sidebar--collapsed"}`}>
        <button
          type="button"
          className="sidebar__toggle"
          aria-label="Toggle sidebar"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Menu aria-hidden size={18} />
        </button>
        <a className="sidebar__brand" href="/" aria-label="Somnia Markets home">
          <span className="brand__mark" aria-hidden>
            <Image
              src="/brand/somnia-market-logo.png"
              alt=""
              width={56}
              height={56}
              priority
            />
          </span>
        </a>

        <div className="sidebar__children">{isConnected ? sidebar : null}</div>

        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__wallet"
            aria-label={isConnected ? `Disconnect wallet ${walletLabel}` : "Connect wallet"}
            disabled={!isConnected && isConnecting}
            onClick={() => (isConnected ? disconnect() : void connect())}
          >
            <span className="sidebar__wallet-dot" data-connected={isConnected ? "true" : "false"} aria-hidden />
            <span className="sidebar__wallet-label">{isConnected ? walletLabel : "Wallet"}</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        {isConnected ? (
          children
        ) : (
          <section className="wallet-gate" aria-labelledby="wallet-gate-title">
            <div className="wallet-gate__panel">
              <p className="label">Wallet</p>
              <h1 id="wallet-gate-title">Connect wallet</h1>
              <p>
                Required to view live Somnia market state and submit contract
                transactions.
              </p>
              <button type="button" className="cta wallet-gate__button" disabled={isConnecting} onClick={() => void connect()}>
                {isConnecting ? "Connecting" : "Connect wallet"}
              </button>
              {error ? <p className="wallet-gate__error">{error}</p> : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
