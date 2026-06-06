import { type Address, isAddress } from "viem";

const ENV_MARKET = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS?.trim();

export const predictionMarketAddress =
  ENV_MARKET && isAddress(ENV_MARKET) ? (ENV_MARKET as Address) : undefined;

export const predictionMarketConfigured = Boolean(predictionMarketAddress);

export const somniaAgentsPlatformAddress = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" as const;
export const somniaParseWebsiteAgentId = 12875401142070969085n;
export const somniaReceiptsBaseUrl = "https://receipts.testnet.agents.somnia.host";

export const sideLabels = ["None", "YES", "NO"] as const;
export const marketStatusLabels = ["None", "Open", "Locked", "Resolving", "Resolved"] as const;
export const responseStatusLabels = ["None", "Pending", "Success", "Failed", "Timed out"] as const;
export const actionKindLabels = [
  "Stake",
  "Policy stake",
  "Claim",
  "Resolution requested",
  "Resolution succeeded",
  "Resolution failed",
] as const;

export const predictionMarketAbi = [
  {
    type: "function",
    name: "SOMNIA_AGENTS_TESTNET",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "LLM_PARSE_WEBSITE_AGENT_ID",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "LLM_PARSE_WEBSITE_COST_PER_VALIDATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DEFAULT_SUBCOMMITTEE_SIZE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question", type: "string" },
      { name: "resolutionPrompt", type: "string" },
      { name: "evidenceUrl", type: "string" },
      { name: "closeTime", type: "uint64" },
      { name: "resolveUrl", type: "bool" },
      { name: "numPages", type: "uint8" },
      { name: "confidenceThreshold", type: "uint8" },
    ],
    outputs: [{ name: "marketId", type: "uint256" }],
  },
  {
    type: "function",
    name: "depositCredit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCredit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "createPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "executor", type: "address" },
      { name: "allowedSide", type: "uint8" },
      { name: "maxStakePerAction", type: "uint256" },
      { name: "maxTotalStake", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "policyId", type: "uint256" }],
  },
  {
    type: "function",
    name: "disablePolicy",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "payable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "side", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "stakeFromCredit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "executePolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "marketId", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requestResolution",
    stateMutability: "payable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [{ name: "payout", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteResolutionCost",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve", type: "uint256" },
      { name: "reward", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "marketPools",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "yesPool", type: "uint256" },
      { name: "noPool", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "positionOf",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "trader", type: "address" },
    ],
    outputs: [
      { name: "yesStake", type: "uint256" },
      { name: "noStake", type: "uint256" },
      { name: "claimedPosition", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "marketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "policyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "actionCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nativeCredits",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "markets",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "question", type: "string" },
      { name: "resolutionPrompt", type: "string" },
      { name: "evidenceUrl", type: "string" },
      { name: "closeTime", type: "uint64" },
      { name: "resolveUrl", type: "bool" },
      { name: "numPages", type: "uint8" },
      { name: "confidenceThreshold", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "outcome", type: "uint8" },
      { name: "yesPool", type: "uint256" },
      { name: "noPool", type: "uint256" },
      { name: "resolutionRequestId", type: "uint256" },
      { name: "resolutionReceipt", type: "uint256" },
      { name: "resolutionOutput", type: "string" },
      { name: "lastResolutionStatus", type: "uint8" },
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "policies",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "executor", type: "address" },
      { name: "allowedSide", type: "uint8" },
      { name: "maxStakePerAction", type: "uint256" },
      { name: "maxTotalStake", type: "uint256" },
      { name: "spent", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
      { name: "enabled", type: "bool" },
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "actions",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "marketId", type: "uint256" },
      { name: "actor", type: "address" },
      { name: "trader", type: "address" },
      { name: "kind", type: "uint8" },
      { name: "side", type: "uint8" },
      { name: "amount", type: "uint256" },
      { name: "policyId", type: "uint256" },
      { name: "requestId", type: "uint256" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MarketCreated",
    anonymous: false,
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "closeTime", type: "uint64", indexed: false },
      { name: "question", type: "string", indexed: false },
      { name: "evidenceUrl", type: "string", indexed: false },
      { name: "resolveUrl", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyCreated",
    anonymous: false,
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "executor", type: "address", indexed: true },
      { name: "allowedSide", type: "uint8", indexed: false },
      { name: "maxStakePerAction", type: "uint256", indexed: false },
      { name: "maxTotalStake", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyDisabled",
    anonymous: false,
    inputs: [{ name: "policyId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "NativeCreditDeposited",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NativeCreditWithdrawn",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentRebateCredited",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketActionRecorded",
    anonymous: false,
    inputs: [
      { name: "actionId", type: "uint256", indexed: true },
      { name: "marketId", type: "uint256", indexed: true },
      { name: "kind", type: "uint8", indexed: true },
      { name: "actor", type: "address", indexed: false },
      { name: "trader", type: "address", indexed: false },
      { name: "side", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "policyId", type: "uint256", indexed: false },
      { name: "requestId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResolutionRequested",
    anonymous: false,
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "resolver", type: "address", indexed: true },
      { name: "requiredDeposit", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResolutionReceived",
    anonymous: false,
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
      { name: "output", type: "string", indexed: false },
      { name: "receipt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketResolved",
    anonymous: false,
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "outcome", type: "uint8", indexed: true },
      { name: "output", type: "string", indexed: false },
      { name: "receipt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResolutionFailed",
    anonymous: false,
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
      { name: "output", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    anonymous: false,
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;
