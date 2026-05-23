import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { somniaTestnet } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "OmniRoute",
    appDescription: "Agentic liquidity router on Somnia",
    walletConnectProjectId: projectId,
    enableAaveAccount: false,
    chains: [somniaTestnet],
    transports: {
      [somniaTestnet.id]: http(),
    },
    ssr: true,
  }),
);
