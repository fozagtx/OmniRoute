"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const label = isConnected && address ? shortAddress(address) : isConnecting ? "Connecting" : "Connect wallet";

  async function connectAndOpenDashboard() {
    const connectedAddress = await connect();
    if (connectedAddress) router.push("/dashboard/clippers");
  }

  return (
    <>
      <button
        type="button"
        className="agent-nav__cta agent-wallet-button"
        aria-label={isConnected && address ? `Disconnect wallet ${shortAddress(address)}` : "Connect wallet"}
        disabled={!isConnected && isConnecting}
        title={error || label}
        onClick={() => (isConnected ? disconnect() : void connectAndOpenDashboard())}
      >
        <span className="agent-wallet-button__dot" data-connected={isConnected ? "true" : "false"} aria-hidden />
        <span>{label}</span>
      </button>
      {isConnected ? (
        <Link className="agent-nav__cta agent-nav__cta--secondary" href="/dashboard/clippers">
          Dashboard
        </Link>
      ) : null}
    </>
  );
}

export function LandingDashboardAction({ children, className }: LandingDashboardActionProps) {
  const { connect, isConnected, isConnecting } = useWallet();
  const router = useRouter();

  async function connectAndOpenDashboard() {
    const connectedAddress = await connect();
    if (connectedAddress) router.push("/dashboard/clippers");
  }

  if (isConnected) {
    return (
      <Link className={className} href="/dashboard/clippers">
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
      onClick={() => void connectAndOpenDashboard()}
    >
      {isConnecting ? "Connecting" : children}
    </button>
  );
}
