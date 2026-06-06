"use client";

import { useState } from "react";
import { ConnectKitButton } from "connectkit";
import { Menu } from "lucide-react";
import { useAccount } from "wagmi";
import { SomniaMarkPaths } from "../SomniaMark";

export default function DashboardLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { isConnected } = useAccount();

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
            <svg width="24" height="18" viewBox="0 0 42.1956 32" fill="none">
              <SomniaMarkPaths />
            </svg>
          </span>
        </a>

        <div className="sidebar__children">{isConnected ? sidebar : null}</div>

        <div className="sidebar__footer">
          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress }) => (
              <button
                type="button"
                className="sidebar__wallet"
                aria-label={isConnected ? `Wallet ${truncatedAddress}` : "Connect wallet"}
                onClick={show}
              >
                <span className="sidebar__wallet-dot" aria-hidden />
                <span className="sidebar__wallet-label">{isConnected ? truncatedAddress : "Wallet"}</span>
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </aside>

      <main className="dashboard-main">
        {isConnected ? (
          children
        ) : (
          <section className="wallet-gate" aria-labelledby="wallet-gate-title">
            <div className="wallet-gate__panel">
              <p className="label">Wallet required</p>
              <h1 id="wallet-gate-title">Connect before the market console opens.</h1>
              <p>
                The console reads live Somnia state and can submit contract
                transactions. It stays closed until a wallet is connected.
              </p>
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button type="button" className="cta wallet-gate__button" onClick={show}>
                    Connect wallet
                  </button>
                )}
              </ConnectKitButton.Custom>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
