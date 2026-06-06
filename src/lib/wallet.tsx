"use client";

import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  isAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { somniaTestnet } from "./chains";

type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged", listener: (value: unknown) => void): void;
  removeListener?(event: "accountsChanged", listener: (value: unknown) => void): void;
};

type ReadContractInput = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
};

type WriteContractInput = ReadContractInput & {
  account: Address;
  value?: bigint;
};

type TransactionReceipt = {
  blockNumber: bigint;
  status?: Hex;
  transactionHash: Hex;
};

type PublicClientLite = {
  readContract(input: ReadContractInput): Promise<unknown>;
  waitForTransactionReceipt(input: { hash: Hex }): Promise<TransactionReceipt>;
};

type WalletClientLite = {
  writeContract(input: WriteContractInput): Promise<Hex>;
};

const rpcUrl = somniaTestnet.rpcUrls.default.http[0];
const chainIdHex = `0x${somniaTestnet.id.toString(16)}`;

type JsonRpcResponse = {
  result?: unknown;
  error?: { message?: string };
};

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  const body = (await response.json()) as JsonRpcResponse;
  if (body.error) throw new Error(body.error.message ?? `${method} failed`);
  return body.result;
}

function getInjectedProvider() {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: InjectedProvider }).ethereum;
}

function toQuantity(value: bigint) {
  return `0x${value.toString(16)}` as Hex;
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" && isAddress(value) ? getAddress(value) : undefined;
}

async function ensureSomniaChain(provider: InjectedProvider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: somniaTestnet.name,
          nativeCurrency: somniaTestnet.nativeCurrency,
          rpcUrls: somniaTestnet.rpcUrls.default.http,
          blockExplorerUrls: [somniaTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}

export const somniaPublicClient: PublicClientLite = {
  async readContract({ address, abi, args, functionName }) {
    const data = encodeFunctionData({ abi: abi as Abi, args, functionName });
    const result = (await rpc("eth_call", [{ to: address, data }, "latest"])) as Hex;
    return decodeFunctionResult({ abi: abi as Abi, data: result, functionName });
  },

  async waitForTransactionReceipt({ hash }) {
    for (;;) {
      const receipt = (await rpc("eth_getTransactionReceipt", [hash])) as
        | { blockNumber: Hex; status?: Hex; transactionHash: Hex }
        | null;
      if (receipt) {
        return {
          blockNumber: BigInt(receipt.blockNumber),
          status: receipt.status,
          transactionHash: receipt.transactionHash,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  },
};

type WalletContextValue = {
  address?: Address;
  error: string;
  isConnected: boolean;
  isConnecting: boolean;
  publicClient: PublicClientLite;
  walletClient?: WalletClientLite;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address>();
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const walletClient = useMemo<WalletClientLite | undefined>(() => {
    const provider = getInjectedProvider();
    if (!provider || !address) return undefined;
    return {
      async writeContract({ abi, account, address: contractAddress, args, functionName, value }) {
        const data = encodeFunctionData({ abi: abi as Abi, args, functionName });
        return (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              data,
              from: account,
              to: contractAddress,
              ...(value ? { value: toQuantity(value) } : {}),
            },
          ],
        })) as Hex;
      },
    };
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
