import { defineChain } from "viem";

const SOMNIA_TESTNET_RPC = process.env.NEXT_PUBLIC_SOMNIA_RPC;

if (!SOMNIA_TESTNET_RPC) {
  throw new Error("NEXT_PUBLIC_SOMNIA_RPC is required");
}

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: {
      http: [SOMNIA_TESTNET_RPC],
      webSocket: ["wss://api.infra.testnet.somnia.network/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
});
