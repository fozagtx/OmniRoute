"use client";

import { useState } from "react";
import { ConnectKitButton } from "connectkit";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
        </a>

        <div className="sidebar__children">{sidebar}</div>

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

      <main className="dashboard-main">{children}</main>
    </div>
  );
}
