import { NextRequest } from "next/server";
import { createPublicClient, createWalletClient, defineChain, formatEther, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia", symbol: "SOMI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.infra.testnet.somnia.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://explorer.testnet.somnia.network",
    },
  },
  testnet: true,
});

const keeperEscrowAbi = [
  {
    type: "function",
    name: "scheduledTransferCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteScheduledTransferCost",
    stateMutability: "view",
    inputs: [{ name: "maxChecks", type: "uint256" }],
    outputs: [
      { name: "perCheckCost", type: "uint256" },
      { name: "checkBudget", type: "uint256" },
      { name: "llmCost", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "scheduledTransfers",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "depositor", type: "address" },
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "targetRate", type: "uint256" },
      { name: "checkBudget", type: "uint256" },
      { name: "llmCostReserved", type: "uint256" },
      { name: "gasEscrow", type: "uint256" },
      { name: "maxChecks", type: "uint256" },
      { name: "checksUsed", type: "uint256" },
      { name: "destinationCurrency", type: "string" },
      { name: "destinationAccount", type: "string" },
      { name: "rateUrl", type: "string" },
      { name: "rateJsonPath", type: "string" },
      { name: "active", type: "bool" },
      { name: "settling", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "checkScheduledTransfer",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "rateRequestId", type: "uint256" }],
  },
] as const;

type ScheduledTransferTuple = readonly [
  Address,
  Address,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  string,
  string,
  string,
  string,
  boolean,
  boolean,
];

type CheckedJob = {
  jobId: string;
  hash: Hex;
  blockNumber: string;
};

type SkippedJob = {
  jobId: string;
  reason: string;
};

function readRequiredPositiveInt(name: string, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} is not configured`);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  if (parsed > max) throw new Error(`${name} must be ${max} or less`);
  return parsed;
}

function readKeeperPrivateKey() {
  const raw = process.env.CRON_KEEPER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("CRON_KEEPER_PRIVATE_KEY must be a 32-byte hex private key");
  }
  return normalized as Hex;
}

function readEscrowAddress() {
  const raw = process.env.ESCROW_ADDRESS?.trim() || process.env.NEXT_PUBLIC_ESCROW_ADDRESS?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    throw new Error("NEXT_PUBLIC_ESCROW_ADDRESS must be a deployed contract address");
  }
  return raw as Address;
}

function rejectUnauthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function decodeScheduledTransfer(value: unknown) {
  const job = value as ScheduledTransferTuple;
  return {
    checkBudget: job[5],
    maxChecks: job[8],
    checksUsed: job[9],
    active: job[14],
    settling: job[15],
  };
}

function shortError(err: unknown) {
  const message = err instanceof Error ? err.message : "job check failed";
  return message.replace(/\s+/g, " ").slice(0, 220);
}

export async function GET(request: NextRequest) {
  const unauthorized = rejectUnauthorized(request);
  if (unauthorized) return unauthorized;

  let keeperKey: Hex;
  try {
    const configuredKey = readKeeperPrivateKey();
    if (!configuredKey) {
      return Response.json({ ok: false, error: "CRON_KEEPER_PRIVATE_KEY is not configured" }, { status: 500 });
    }
    keeperKey = configuredKey;
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Invalid keeper key" }, { status: 500 });
  }

  const rpcUrl = process.env.SOMNIA_RPC_URL?.trim() || process.env.NEXT_PUBLIC_SOMNIA_RPC?.trim();
  if (!rpcUrl) {
    return Response.json({ ok: false, error: "SOMNIA_RPC_URL is not configured" }, { status: 500 });
  }

  let escrowAddress: Address;
  try {
    escrowAddress = readEscrowAddress();
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Escrow address is not configured" }, { status: 500 });
  }

  let maxChecksPerRun: number;
  let scanLimit: number;
  try {
    maxChecksPerRun = readRequiredPositiveInt("CRON_MAX_SCHEDULED_CHECKS_PER_RUN", 5);
    scanLimit = readRequiredPositiveInt("CRON_SCHEDULED_JOB_SCAN_LIMIT", 1000);
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Cron scan limits are not configured" }, { status: 500 });
  }

  const account = privateKeyToAccount(keeperKey);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: somniaTestnet, transport });
  const walletClient = createWalletClient({ account, chain: somniaTestnet, transport });
  const checked: CheckedJob[] = [];
  const skipped: SkippedJob[] = [];

  try {
    const chainId = await publicClient.getChainId();
    if (chainId !== somniaTestnet.id) {
      return Response.json({ ok: false, error: `Unexpected chain id ${chainId}` }, { status: 500 });
    }

    const keeperBalance = await publicClient.getBalance({ address: account.address });
    if (keeperBalance === 0n) {
      return Response.json({ ok: false, error: "Keeper wallet has no native gas balance", keeper: account.address }, { status: 503 });
    }

    const [jobCount, scheduledQuote] = await Promise.all([
      publicClient.readContract({
        address: escrowAddress,
        abi: keeperEscrowAbi,
        functionName: "scheduledTransferCount",
      }),
      publicClient.readContract({
        address: escrowAddress,
        abi: keeperEscrowAbi,
        functionName: "quoteScheduledTransferCost",
        args: [1n],
      }),
    ]);
    const perCheckCost = scheduledQuote[0];

    let scanned = 0;
    let jobId = jobCount;
    while (jobId > 0n && scanned < scanLimit && checked.length < maxChecksPerRun) {
      const currentJobId = jobId;
      scanned += 1;
      jobId -= 1n;

      try {
        const job = decodeScheduledTransfer(
          await publicClient.readContract({
            address: escrowAddress,
            abi: keeperEscrowAbi,
            functionName: "scheduledTransfers",
            args: [currentJobId],
          }),
        );

        if (!job.active) {
          skipped.push({ jobId: currentJobId.toString(), reason: "closed" });
          continue;
        }
        if (job.settling) {
          skipped.push({ jobId: currentJobId.toString(), reason: "rate check already running" });
          continue;
        }
        if (job.checksUsed >= job.maxChecks) {
          skipped.push({ jobId: currentJobId.toString(), reason: "check limit reached" });
          continue;
        }
        if (job.checkBudget < perCheckCost) {
          skipped.push({ jobId: currentJobId.toString(), reason: "check budget exhausted" });
          continue;
        }

        const hash = await walletClient.writeContract({
          address: escrowAddress,
          abi: keeperEscrowAbi,
          functionName: "checkScheduledTransfer",
          args: [currentJobId],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        checked.push({
          jobId: currentJobId.toString(),
          hash,
          blockNumber: receipt.blockNumber.toString(),
        });
      } catch (err) {
        skipped.push({ jobId: currentJobId.toString(), reason: shortError(err) });
      }
    }

    return Response.json({
      ok: true,
      escrow: escrowAddress,
      keeper: account.address,
      keeperBalance: `${formatEther(keeperBalance)} STT`,
      highestJobId: jobCount.toString(),
      scanned,
      checked,
      skipped: skipped.slice(0, 25),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        escrow: escrowAddress,
        keeper: account.address,
        checked,
        skipped: skipped.slice(0, 25),
        error: err instanceof Error ? err.message : "Scheduled transfer check failed",
      },
      { status: 500 },
    );
  }
}
