import { type Address, isAddress } from "viem";

const ENV_BOUNTY = process.env.NEXT_PUBLIC_CLIP_BOUNTY_ADDRESS?.trim();

export const clipBountyAddress = ENV_BOUNTY && isAddress(ENV_BOUNTY) ? (ENV_BOUNTY as Address) : undefined;

export const clipBountyConfigured = Boolean(clipBountyAddress);

export const somniaAgentsPlatformAddress = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" as const;
export const somniaParseWebsiteAgentId = 12875401142070969085n;

export const bountyStatusLabels = ["None", "Open", "Closed"] as const;
export const submissionStatusLabels = ["None", "Submitted", "Checking", "Rejected", "Paid"] as const;
export const responseStatusLabels = ["None", "Pending", "Success", "Failed", "Timed out"] as const;

export const clipBountyAbi = [
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
    name: "createBounty",
    stateMutability: "payable",
    inputs: [
      { name: "title", type: "string" },
      { name: "campaignUrl", type: "string" },
      { name: "rules", type: "string" },
      { name: "minViews", type: "uint256" },
      { name: "rewardPerClip", type: "uint256" },
      { name: "maxPayouts", type: "uint256" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "bountyId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundBounty",
    stateMutability: "payable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "closeBounty",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ name: "refunded", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitClip",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "clipUrl", type: "string" },
    ],
    outputs: [{ name: "submissionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "requestVerification",
    stateMutability: "payable",
    inputs: [{ name: "submissionId", type: "uint256" }],
    outputs: [{ name: "requestId", type: "uint256" }],
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
    name: "quoteVerificationCost",
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
    name: "bountyAvailable",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ name: "available", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBountySubmissionIds",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ name: "ids", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "bountyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "submissionCount",
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
    name: "bounties",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "title", type: "string" },
      { name: "campaignUrl", type: "string" },
      { name: "rules", type: "string" },
      { name: "minViews", type: "uint256" },
      { name: "rewardPerClip", type: "uint256" },
      { name: "maxPayouts", type: "uint256" },
      { name: "totalFunded", type: "uint256" },
      { name: "totalPaid", type: "uint256" },
      { name: "submissionCount", type: "uint256" },
      { name: "approvedCount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "submissions",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "bountyId", type: "uint256" },
      { name: "clipper", type: "address" },
      { name: "clipUrl", type: "string" },
      { name: "submittedAt", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "requestId", type: "uint256" },
      { name: "receipt", type: "uint256" },
      { name: "observedViews", type: "uint256" },
      { name: "verificationOutput", type: "string" },
      { name: "paidAmount", type: "uint256" },
    ],
  },
] as const;
