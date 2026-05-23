import type { Address } from "viem";

const ENV_ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;

export const escrowConfigured =
  !!ENV_ESCROW &&
  /^0x[0-9a-fA-F]{40}$/.test(ENV_ESCROW) &&
  ENV_ESCROW.toLowerCase() !== "0x0000000000000000000000000000000000000000";

if (!escrowConfigured) {
  throw new Error("NEXT_PUBLIC_ESCROW_ADDRESS must be a real deployed contract address");
}

export const escrowAddress = ENV_ESCROW as Address;

/**
 * OmniRouteEscrow — minimal ABI for events the dashboard reads/streams
 * and the single state-changing call it exposes.
 *
 * Two-stage settlement:
 *   TransferRequested  → user opened the route
 *   RateFetched        → JSON API subcommittee returned a rate
 *   SettlementReceipt  → LLM verdict + final outcome (approved | rejected | slippage | failure)
 *   TransferSettled / TransferRefunded fire alongside SettlementReceipt so the
 *   Reactor's existing topic subscriptions still increment counters.
 */
export const escrowAbi = [
  {
    type: "event",
    name: "TransferRequested",
    inputs: [
      { name: "rateRequestId", type: "uint256", indexed: true },
      { name: "depositor", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "minOut", type: "uint256", indexed: false },
      { name: "destinationCurrency", type: "string", indexed: false },
      { name: "destinationAccount", type: "string", indexed: false },
      { name: "rateUrl", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RateFetched",
    inputs: [
      { name: "rateRequestId", type: "uint256", indexed: true },
      { name: "llmRequestId", type: "uint256", indexed: true },
      { name: "fxRate", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TransferSettled",
    inputs: [
      { name: "rateRequestId", type: "uint256", indexed: true },
      { name: "fxRate", type: "uint256", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "remainingPlatformBudget", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TransferRefunded",
    inputs: [
      { name: "rateRequestId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SettlementReceipt",
    inputs: [
      { name: "rateRequestId", type: "uint256", indexed: true },
      { name: "depositor", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: true },
      { name: "fxRate", type: "uint256", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "rateUrl", type: "string", indexed: false },
      { name: "llmVerdict", type: "string", indexed: false },
      { name: "subcommitteeSize", type: "uint256", indexed: false },
      { name: "quorum", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "requestTransfer",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "destinationCurrency", type: "string" },
      { name: "destinationAccount", type: "string" },
      { name: "rateUrl", type: "string" },
      { name: "rateJsonPath", type: "string" },
    ],
    outputs: [{ name: "rateRequestId", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteTotalCost",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve", type: "uint256" },
      { name: "jsonReward", type: "uint256" },
      { name: "llmReward", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "subcommitteeSize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "consensusThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
