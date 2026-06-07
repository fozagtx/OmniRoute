"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";

type LandingDashboardActionProps = {
  children: ReactNode;
  className?: string;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function LandingWalletButton() {
  const { address, connect, disconnect, error, isConnected, isConnecting } = useWallet();
  const label = isConnected && address ? shortAddress(address) : isConnecting ? "Connecting" : "Connect wallet";

  return (
    <>
      <button
        type="button"
        className="agent-nav__cta agent-wallet-button"
        aria-label={isConnected && address ? `Disconnect wallet ${shortAddress(address)}` : "Connect wallet"}
        disabled={!isConnected && isConnecting}
        title={error || label}
        onClick={() => (isConnected ? disconnect() : void connect())}
      >
        <span className="agent-wallet-button__dot" data-connected={isConnected ? "true" : "false"} aria-hidden />
        <span>{label}</span>
      </button>
      {isConnected ? (
        <Link className="agent-nav__cta agent-nav__cta--secondary" href="/dashboard">
          Dashboard
        </Link>
      ) : null}
    </>
  );
}

export function LandingDashboardAction({ children, className }: LandingDashboardActionProps) {
  const { connect, isConnected, isConnecting } = useWallet();

  if (isConnected) {
    return (
      <Link className={className} href="/dashboard">
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label="Connect wallet to open dashboard"
      disabled={isConnecting}
      onClick={() => void connect()}
    >
      {isConnecting ? "Connecting" : children}
    </button>
  );
}
