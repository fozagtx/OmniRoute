import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { somniaTestnet } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "Somnia Market Console",
    appDescription: "Agentic prediction-market execution and resolution on Somnia",
    walletConnectProjectId: projectId,
    enableAaveAccount: false,
    chains: [somniaTestnet],
    transports: {
      [somniaTestnet.id]: http(),
    },
    ssr: true,
  }),
);
