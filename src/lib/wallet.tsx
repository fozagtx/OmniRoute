"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  isAddress,
  numberToHex,
  type Address,
  type WalletClient,
} from "viem";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { somniaTestnet } from "./chains";

type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
};

export const somniaPublicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

type WalletContextValue = {
  address?: Address;
  error: string;
  isConnected: boolean;
  isConnecting: boolean;
  publicClient: typeof somniaPublicClient;
  walletClient?: WalletClient;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function getInjectedProvider() {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: InjectedProvider }).ethereum;
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" && isAddress(value) ? getAddress(value) : undefined;
}

async function ensureSomniaChain(provider: InjectedProvider) {
  const chainId = numberToHex(somniaTestnet.id);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: somniaTestnet.name,
          nativeCurrency: somniaTestnet.nativeCurrency,
          rpcUrls: somniaTestnet.rpcUrls.default.http,
          blockExplorerUrls: [somniaTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address>();
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const walletClient = useMemo(() => {
    const provider = getInjectedProvider();
    if (!provider || !address) return undefined;
    return createWalletClient({
      account: address,
      chain: somniaTestnet,
      transport: custom(provider),
    });
  }, [address]);

  const connect = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet detected.");
      return;
    }

    setError("");
    setIsConnecting(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as unknown[];
      const nextAddress = normalizeAddress(accounts[0]);
      if (!nextAddress) throw new Error("Wallet did not return a valid account.");
      await ensureSomniaChain(provider);
      setAddress(nextAddress);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setError("");
  }, []);

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;

    void provider.request({ method: "eth_accounts" }).then((accounts: unknown) => {
      const nextAddress = Array.isArray(accounts) ? normalizeAddress(accounts[0]) : undefined;
      if (nextAddress) setAddress(nextAddress);
    });

    const onAccountsChanged = (accounts: unknown) => {
      const nextAddress = Array.isArray(accounts) ? normalizeAddress(accounts[0]) : undefined;
      setAddress(nextAddress);
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        error,
        isConnected: Boolean(address),
        isConnecting,
        publicClient: somniaPublicClient,
        walletClient,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider.");
  return value;
}
