"use client";

import { useWallet } from "@/lib/wallet";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function LandingWalletButton() {
  const { address, connect, disconnect, error, isConnected, isConnecting } = useWallet();
  const label = isConnected && address ? shortAddress(address) : isConnecting ? "Connecting" : "Connect wallet";

  return (
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
  );
}
