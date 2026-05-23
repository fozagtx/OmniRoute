"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { wagmiConfig } from "@/lib/wagmi";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          options={{ initialChainId: 50312 }}
          customTheme={{
            "--ck-font-family": "GeistVariable, sans-serif",
            "--ck-border-radius": "1.875rem",
            "--ck-accent-color": "#9E79D2",
            "--ck-accent-text-color": "#FBFBFD",
            "--ck-body-background": "#17191C",
            "--ck-body-background-secondary": "#292C32",
            "--ck-body-background-tertiary": "#4C515D",
            "--ck-body-color": "#D1D6E0",
            "--ck-body-color-muted": "#8A8FA8",
            "--ck-primary-button-border-radius": "3.75rem",
            "--ck-primary-button-background": "#9E79D2",
            "--ck-primary-button-color": "#FBFBFD",
            "--ck-primary-button-hover-background": "#8353C5",
            "--ck-secondary-button-border-radius": "3.75rem",
            "--ck-secondary-button-background": "#FBFBFD",
            "--ck-secondary-button-color": "#292C32",
            "--ck-connectbutton-background": "#9E79D2",
            "--ck-connectbutton-hover-background": "#8353C5",
            "--ck-connectbutton-color": "#FBFBFD",
            "--ck-connectbutton-hover-color": "#FBFBFD",
            "--ck-connectbutton-border-radius": "3.75rem",
            "--ck-connectbutton-box-shadow": "0px 2px 4px 0px rgba(0, 0, 0, 0.20), 0px 5px 50px -1px rgba(0, 0, 0, 0.33)",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
