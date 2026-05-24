import { isAddress, type Address } from "viem";

type TokenOption = {
  symbol: string;
  label: string;
  address: string | undefined;
};

export const tokenOptions: TokenOption[] = [
  {
    symbol: "USDC",
    label: "USDC",
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  },
] satisfies TokenOption[];

export function getDefaultTokenSymbol() {
  return "USDC";
}

export function getTokenBySymbol(symbol: string) {
  return tokenOptions.find((token) => token.symbol === symbol);
}

export function getTokenAddress(token: TokenOption | undefined) {
  if (!token || typeof token.address !== "string" || !isAddress(token.address)) {
    throw new Error("USDC address is not configured");
  }

  return token.address as Address;
}

export function tokenConfigured(token: TokenOption | undefined) {
  return typeof token?.address === "string" && isAddress(token.address);
}
