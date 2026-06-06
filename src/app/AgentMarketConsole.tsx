"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { decodeEventLog, formatEther, isAddress, parseEther, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  actionKindLabels,
  marketStatusLabels,
  predictionMarketAbi,
  predictionMarketAddress,
  predictionMarketConfigured,
  responseStatusLabels,
  sideLabels,
  somniaReceiptsBaseUrl,
} from "@/lib/predictionMarket";

type LogRow = {
  key: string;
  kind: string;
  blockNumber: bigint;
  logIndex: number;
  label: string;
  detail: string;
  href?: string;
};

const marketSourcePresets = [
  {
    id: "somnia-agents-docs",
    label: "Somnia Agents docs",
    question: "Does the Somnia Agents documentation page describe Somnia Agents?",
    resolutionPrompt: "Return exactly YES if the page describes Somnia Agents, otherwise return NO.",
    evidenceUrl: "https://docs.somnia.network/agents",
    resolveUrl: false,
    numPages: 1,
    confidenceThreshold: 70,
  },
  {
    id: "somnia-market-explorer",
    label: "Market contract explorer",
    question: "Does the Shannon explorer page show the deployed SomniaPredictionMarket contract?",
    resolutionPrompt:
      "Return exactly YES if the page is for contract 0x157337Ee4373Ae2FA7bb2D609bB4EE7ecf0e7e78, otherwise return NO.",
    evidenceUrl: "https://shannon-explorer.somnia.network/address/0x157337Ee4373Ae2FA7bb2D609bB4EE7ecf0e7e78",
    resolveUrl: false,
    numPages: 1,
    confidenceThreshold: 70,
  },
] as const;

const defaultMarketSource = marketSourcePresets[0];

function shortAddress(value?: string) {
  if (!value) return "not read";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parsePositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseSide(value: string, label: string) {
  const parsed = parsePositiveInteger(value, label);
  if (parsed !== 1 && parsed !== 2) {
    throw new Error(`${label} must be YES or NO.`);
  }
  return parsed;
}

function parsePolicySide(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2) {
    throw new Error(`${label} must be Any, YES, or NO.`);
  }
  return parsed;
}

function parseNativeAmount(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
  return parseEther(value.trim());
}

function formatNative(value: bigint | undefined) {
  return typeof value === "bigint" ? `${formatEther(value)} STT` : "not read";
}

function receiptHref(receiptOrRequestId: bigint | number | string | undefined) {
  if (receiptOrRequestId === undefined) return undefined;
  const value = receiptOrRequestId.toString();
  return value === "0" ? undefined : `${somniaReceiptsBaseUrl}/receipts/${value}`;
}

function labelFrom<T extends readonly string[]>(labels: T, value: number | bigint | undefined) {
  if (value === undefined) return "not read";
  const index = typeof value === "bigint" ? Number(value) : value;
  return labels[index] ?? `#${index}`;
}

export default function AgentMarketConsole() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [revealed, setRevealed] = useState(false);

  const [sourceId, setSourceId] = useState<string>(defaultMarketSource.id);
  const [question, setQuestion] = useState<string>(defaultMarketSource.question);
  const [resolutionPrompt, setResolutionPrompt] = useState<string>(defaultMarketSource.resolutionPrompt);
  const [evidenceUrl, setEvidenceUrl] = useState<string>(defaultMarketSource.evidenceUrl);
  const [closeDays, setCloseDays] = useState("7");
  const [resolveUrl, setResolveUrl] = useState(defaultMarketSource.resolveUrl);
  const [numPages, setNumPages] = useState(String(defaultMarketSource.numPages));
  const [confidenceThreshold, setConfidenceThreshold] = useState(String(defaultMarketSource.confidenceThreshold));

  const [executor, setExecutor] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [allowedSide, setAllowedSide] = useState("");
  const [maxStake, setMaxStake] = useState("");
  const [maxTotalStake, setMaxTotalStake] = useState("");
  const [policyExpiryDays, setPolicyExpiryDays] = useState("");

  const [marketId, setMarketId] = useState("");
  const [stakeSide, setStakeSide] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [policySide, setPolicySide] = useState("");
  const [policyAmount, setPolicyAmount] = useState("");
  const [resolutionMarketId, setResolutionMarketId] = useState("");
  const [selectedActionId, setSelectedActionId] = useState("");

  const [feedback, setFeedback] = useState("");
  const [logRows, setLogRows] = useState<LogRow[]>([]);
  const [logsError, setLogsError] = useState("");

  const contractEnabled = predictionMarketConfigured && Boolean(predictionMarketAddress);

  const marketIdForRead = useMemo(() => {
    const parsed = Number.parseInt(marketId, 10);
    return Number.isInteger(parsed) && parsed > 0 ? BigInt(parsed) : undefined;
  }, [marketId]);

  const actionIdForRead = useMemo(() => {
    const parsed = Number.parseInt(selectedActionId, 10);
    return Number.isInteger(parsed) && parsed > 0 ? BigInt(parsed) : undefined;
  }, [selectedActionId]);

  const { data: quoteCost } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "quoteResolutionCost",
    query: { enabled: contractEnabled },
  });

  const { data: platformAddress } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "SOMNIA_AGENTS_TESTNET",
    query: { enabled: contractEnabled },
  });

  const { data: parseAgentId } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "LLM_PARSE_WEBSITE_AGENT_ID",
    query: { enabled: contractEnabled },
  });

  const { data: subcommitteeSize } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "DEFAULT_SUBCOMMITTEE_SIZE",
    query: { enabled: contractEnabled },
  });

  const { data: marketCount } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "marketCount",
    query: { enabled: contractEnabled },
  });

  const { data: policyCount } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "policyCount",
    query: { enabled: contractEnabled },
  });

  const { data: actionCount } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "actionCount",
    query: { enabled: contractEnabled },
  });

  const { data: nativeCredit } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "nativeCredits",
    args: address ? [address] : undefined,
    query: { enabled: contractEnabled && Boolean(address) },
  });

  const { data: selectedMarket } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "markets",
    args: marketIdForRead ? [marketIdForRead] : undefined,
    query: { enabled: contractEnabled && Boolean(marketIdForRead) },
  });

  const { data: marketPools } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "marketPools",
    args: marketIdForRead ? [marketIdForRead] : undefined,
    query: { enabled: contractEnabled && Boolean(marketIdForRead) },
  });

  const { data: position } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "positionOf",
    args: marketIdForRead && address ? [marketIdForRead, address] : undefined,
    query: { enabled: contractEnabled && Boolean(marketIdForRead && address) },
  });

  const { data: selectedAction } = useReadContract({
    address: predictionMarketAddress,
    abi: predictionMarketAbi,
    functionName: "actions",
    args: actionIdForRead ? [actionIdForRead] : undefined,
    query: { enabled: contractEnabled && Boolean(actionIdForRead) },
  });

  const resolutionCost = quoteCost?.[2];
  const marketCountText = typeof marketCount === "bigint" ? marketCount.toString() : "not read";
  const policyCountText = typeof policyCount === "bigint" ? policyCount.toString() : "not read";
  const actionCountText = typeof actionCount === "bigint" ? actionCount.toString() : "not read";

  const loadLogs = useCallback(async () => {
    if (!publicClient || !predictionMarketAddress) return;

    setLogsError("");
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 5_000n ? latest - 5_000n : 0n;
      const logs = await publicClient.getLogs({
        address: predictionMarketAddress,
        fromBlock,
        toBlock: latest,
      });

      const rows: LogRow[] = [];
      for (const log of logs) {
        try {
          if (!log.topics[0]) continue;
          const decoded = decodeEventLog({
            abi: predictionMarketAbi,
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          });

          if (decoded.eventName === "MarketCreated") {
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Market",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Market ${decoded.args.marketId.toString()} created`,
              detail: decoded.args.question,
            });
          }

          if (decoded.eventName === "PolicyCreated") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Policy",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Policy ${args.policyId.toString()} created`,
              detail: `${labelFrom(sideLabels, args.allowedSide)} / executor ${shortAddress(args.executor)}`,
            });
          }

          if (decoded.eventName === "MarketActionRecorded") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Action",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Action ${args.actionId.toString()} / market ${args.marketId.toString()}`,
              detail: `${labelFrom(actionKindLabels, args.kind)} / ${labelFrom(sideLabels, args.side)} / ${formatNative(args.amount)}`,
              href: receiptHref(args.requestId),
            });
          }

          if (decoded.eventName === "ResolutionRequested") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Resolve",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Market ${args.marketId.toString()} requested`,
              detail: `request ${args.requestId.toString()} / deposit ${formatNative(args.requiredDeposit)}`,
              href: receiptHref(args.requestId),
            });
          }

          if (decoded.eventName === "ResolutionReceived") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Receipt",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Market ${args.marketId.toString()} receipt`,
              detail: `${labelFrom(responseStatusLabels, args.status)} / ${args.output}`,
              href: receiptHref(args.receipt),
            });
          }

          if (decoded.eventName === "MarketResolved") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Resolved",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Market ${args.marketId.toString()} ${labelFrom(sideLabels, args.outcome)}`,
              detail: args.output,
              href: receiptHref(args.receipt),
            });
          }

          if (decoded.eventName === "ResolutionFailed") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Failed",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Market ${args.marketId.toString()} failed`,
              detail: `${labelFrom(responseStatusLabels, args.status)} / ${args.output}`,
            });
          }

          if (decoded.eventName === "Claimed") {
            const args = decoded.args;
            rows.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              kind: "Claim",
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
              label: `Market ${args.marketId.toString()} claimed`,
              detail: `${shortAddress(args.trader)} / ${formatNative(args.payout)}`,
            });
          }
        } catch {
          continue;
        }
      }

      rows.sort((a, b) => {
        if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
        return a.blockNumber > b.blockNumber ? -1 : 1;
      });
      setLogRows(rows.slice(0, 12));
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "Could not read contract logs.");
    }
  }, [publicClient]);

  useEffect(() => {
    setRevealed(true);
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function onSelectMarketSource(nextSourceId: string) {
    const source = marketSourcePresets.find((item) => item.id === nextSourceId) ?? defaultMarketSource;
    setSourceId(source.id);
    setQuestion(source.question);
    setResolutionPrompt(source.resolutionPrompt);
    setEvidenceUrl(source.evidenceUrl);
    setResolveUrl(source.resolveUrl);
    setNumPages(String(source.numPages));
    setConfidenceThreshold(String(source.confidenceThreshold));
  }

  async function onCreateMarket(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      if (!question.trim() || !resolutionPrompt.trim() || !evidenceUrl.trim()) {
        throw new Error("Question, resolution prompt, and evidence URL are required.");
      }
      const days = parsePositiveInteger(closeDays, "Close days");
      const pages = parsePositiveInteger(numPages, "Page count");
      const confidence = parsePositiveInteger(confidenceThreshold, "Confidence threshold");
      if (pages > 255) throw new Error("Page count must fit uint8.");
      if (confidence > 100) throw new Error("Confidence threshold must be 100 or less.");
      const closeTime = BigInt(Math.floor(Date.now() / 1000) + days * 86_400);

      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "createMarket",
        args: [question.trim(), resolutionPrompt.trim(), evidenceUrl.trim(), closeTime, resolveUrl, pages, confidence],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const nextMarketCount = await publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "marketCount",
      });
      setMarketId(nextMarketCount.toString());
      setResolutionMarketId(nextMarketCount.toString());
      setFeedback(`Market created in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Market transaction failed.");
    }
  }

  async function onCreatePolicy(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const executorAddress = executor.trim() || address;
      if (!executorAddress || !isAddress(executorAddress)) {
        throw new Error("Executor must be a valid EVM address.");
      }
      const side = parsePolicySide(allowedSide, "Allowed side");
      const maxStakePerAction = parseNativeAmount(maxStake, "Max stake");
      const maxTotal = parseNativeAmount(maxTotalStake, "Max total stake");
      const days = parsePositiveInteger(policyExpiryDays, "Policy expiry days");
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + days * 86_400);

      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "createPolicy",
        args: [executorAddress as Address, side, maxStakePerAction, maxTotal, expiresAt],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const nextPolicyCount = await publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "policyCount",
      });
      setPolicyId(nextPolicyCount.toString());
      setFeedback(`Policy created in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Policy transaction failed.");
    }
  }

  async function onDepositCredit() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const value = parseNativeAmount(creditAmount, "Credit amount");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "depositCredit",
        value,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Credit deposited in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Credit deposit failed.");
    }
  }

  async function onWithdrawCredit() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const amount = parseNativeAmount(creditAmount, "Credit amount");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "withdrawCredit",
        args: [amount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Credit withdrawn in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Credit withdrawal failed.");
    }
  }

  async function onDisablePolicy() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedPolicyId = parsePositiveInteger(policyId, "Policy ID");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "disablePolicy",
        args: [BigInt(parsedPolicyId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Policy disabled in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Policy disable failed.");
    }
  }

  async function onStake() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedMarketId = parsePositiveInteger(marketId, "Market ID");
      const side = parseSide(stakeSide, "Stake side");
      const value = parseNativeAmount(stakeAmount, "Stake amount");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "stake",
        value,
        args: [BigInt(parsedMarketId), side],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Stake recorded in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Stake transaction failed.");
    }
  }

  async function onStakeFromCredit() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedMarketId = parsePositiveInteger(marketId, "Market ID");
      const side = parseSide(stakeSide, "Stake side");
      const amount = parseNativeAmount(stakeAmount, "Stake amount");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "stakeFromCredit",
        args: [BigInt(parsedMarketId), side, amount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Credit stake recorded in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Credit stake failed.");
    }
  }

  async function onExecutePolicy() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedPolicyId = parsePositiveInteger(policyId, "Policy ID");
      const parsedMarketId = parsePositiveInteger(marketId, "Market ID");
      const side = parseSide(policySide, "Policy side");
      const amount = parseNativeAmount(policyAmount, "Policy amount");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "executePolicy",
        args: [BigInt(parsedPolicyId), BigInt(parsedMarketId), side, amount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Policy execution recorded in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Policy execution failed.");
    }
  }

  async function onRequestResolution() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }
    if (typeof resolutionCost !== "bigint") {
      setFeedback("Resolution fee quote is not available from the contract.");
      return;
    }

    try {
      const parsedMarketId = parsePositiveInteger(resolutionMarketId || marketId, "Resolution market ID");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "requestResolution",
        value: resolutionCost,
        args: [BigInt(parsedMarketId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Resolution requested in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Resolution request failed.");
    }
  }

  async function onClaim() {
    setFeedback("");
    if (!predictionMarketAddress || !publicClient) {
      setFeedback("Prediction market contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedMarketId = parsePositiveInteger(marketId, "Market ID");
      const hash = await writeContractAsync({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "claim",
        args: [BigInt(parsedMarketId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setFeedback(`Claim submitted in block ${receipt.blockNumber.toString()}.`);
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Claim failed.");
    }
  }

  const selectedMarketView = selectedMarket
    ? {
        creator: selectedMarket[0],
        question: selectedMarket[1],
        resolutionPrompt: selectedMarket[2],
        evidenceUrl: selectedMarket[3],
        closeTime: selectedMarket[4],
        resolveUrl: selectedMarket[5],
        numPages: selectedMarket[6],
        confidenceThreshold: selectedMarket[7],
        status: selectedMarket[8],
        outcome: selectedMarket[9],
        yesPool: selectedMarket[10],
        noPool: selectedMarket[11],
        resolutionRequestId: selectedMarket[12],
        resolutionReceipt: selectedMarket[13],
        resolutionOutput: selectedMarket[14],
        lastResolutionStatus: selectedMarket[15],
      }
    : undefined;

  const selectedActionView = selectedAction
    ? {
        marketId: selectedAction[0],
        actor: selectedAction[1],
        trader: selectedAction[2],
        kind: selectedAction[3],
        side: selectedAction[4],
        amount: selectedAction[5],
        policyId: selectedAction[6],
        requestId: selectedAction[7],
      }
    : undefined;

  return (
    <section
      className="market-console t-panel-slide"
      data-open={revealed ? "true" : "false"}
      aria-label="Agentic prediction market console"
    >
      <header className="market-console__head">
        <div>
          <p className="eyebrow">Somnia-native execution</p>
          <h1 className="display">Prediction market console</h1>
        </div>
        <button type="button" className="cta cta--ghost" onClick={() => void loadLogs()}>
          <RefreshCw aria-hidden size={16} />
          refresh logs
        </button>
      </header>

      <div className="stat-strip market-console__stats">
        <div className="stat">
          <span className="label">Contract</span>
          <strong className="stat__val">{predictionMarketAddress ? shortAddress(predictionMarketAddress) : "unset"}</strong>
        </div>
        <div className="stat">
          <span className="label">Markets</span>
          <strong className="stat__val">{marketCountText}</strong>
        </div>
        <div className="stat">
          <span className="label">Policies</span>
          <strong className="stat__val">{policyCountText}</strong>
        </div>
        <div className="stat">
          <span className="label">Actions</span>
          <strong className="stat__val">{actionCountText}</strong>
        </div>
      </div>

      <div className="grid-2 market-console__grid">
        <form className="panel" onSubmit={onCreateMarket}>
          <div className="panel__head">
            <div>
              <p className="label">1 / market policy</p>
              <strong>Create market</strong>
            </div>
            <ShieldCheck aria-hidden size={20} />
          </div>
          <div className="panel__body">
            <div className="form-grid">
              <label className="field field--wide">
                <span className="label">Market source</span>
                <select value={sourceId} onChange={(event) => onSelectMarketSource(event.target.value)}>
                  {marketSourcePresets.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field--wide">
                <span className="label">Question</span>
                <textarea value={question} readOnly rows={2} />
              </label>
              <label className="field field--wide">
                <span className="label">Resolution prompt</span>
                <textarea value={resolutionPrompt} readOnly rows={3} />
              </label>
              <label className="field field--wide">
                <span className="label">Resolution source</span>
                <div className="asset-readout">
                  <a href={evidenceUrl} target="_blank" rel="noopener noreferrer">
                    {evidenceUrl}
                  </a>
                </div>
              </label>
              <label className="field">
                <span className="label">Close days</span>
                <input inputMode="numeric" value={closeDays} onChange={(event) => setCloseDays(event.target.value)} />
              </label>
              <label className="field">
                <span className="label">Pages</span>
                <input inputMode="numeric" value={numPages} readOnly />
              </label>
              <label className="field">
                <span className="label">Confidence</span>
                <input inputMode="numeric" value={confidenceThreshold} readOnly />
              </label>
            </div>
            <div className="form-actions">
              <span className="form-feedback">{contractEnabled ? "Source is configured by the app." : "Market address not configured."}</span>
              <button type="submit" className="cta" disabled={isPending || !contractEnabled}>
                create market
              </button>
            </div>
          </div>
        </form>

        <form className="panel" onSubmit={onCreatePolicy}>
          <div className="panel__head">
            <div>
              <p className="label">2 / executor guardrail</p>
              <strong>Create policy</strong>
            </div>
            <SlidersHorizontal aria-hidden size={20} />
          </div>
          <div className="panel__body">
            <div className="form-grid">
              <label className="field field--wide">
                <span className="label">Executor</span>
                <input value={executor} onChange={(event) => setExecutor(event.target.value)} />
              </label>
              <label className="field">
                <span className="label">Allowed side</span>
                <select value={allowedSide} onChange={(event) => setAllowedSide(event.target.value)}>
                  <option value="">Select</option>
                  <option value="0">Any</option>
                  <option value="1">YES</option>
                  <option value="2">NO</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Credit amount STT</span>
                <input inputMode="decimal" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} />
              </label>
              <label className="field">
                <span className="label">Expiry days</span>
                <input inputMode="numeric" value={policyExpiryDays} onChange={(event) => setPolicyExpiryDays(event.target.value)} />
              </label>
              <label className="field">
                <span className="label">Max stake/action</span>
                <input inputMode="decimal" value={maxStake} onChange={(event) => setMaxStake(event.target.value)} />
              </label>
              <label className="field">
                <span className="label">Max total stake</span>
                <input inputMode="decimal" value={maxTotalStake} onChange={(event) => setMaxTotalStake(event.target.value)} />
              </label>
            </div>
            <div className="form-actions">
              <span className="form-feedback">Native credit {formatNative(nativeCredit)}</span>
              <div className="form-actions__buttons">
                <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onWithdrawCredit}>
                  withdraw credit
                </button>
                <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onDepositCredit}>
                  deposit credit
                </button>
                <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onDisablePolicy}>
                  disable policy
                </button>
                <button type="submit" className="cta" disabled={isPending || !contractEnabled}>
                  create policy
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="label">3 / execution and resolution</p>
            <strong>Run market actions</strong>
          </div>
        </div>
        <div className="panel__body">
          <div className="form-grid">
            <label className="field">
              <span className="label">Market ID</span>
              <input inputMode="numeric" value={marketId} onChange={(event) => setMarketId(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Stake side</span>
              <select value={stakeSide} onChange={(event) => setStakeSide(event.target.value)}>
                <option value="">Select</option>
                <option value="1">YES</option>
                <option value="2">NO</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Stake value STT</span>
              <input inputMode="decimal" value={stakeAmount} onChange={(event) => setStakeAmount(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Policy ID</span>
              <input inputMode="numeric" value={policyId} onChange={(event) => setPolicyId(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Policy side</span>
              <select value={policySide} onChange={(event) => setPolicySide(event.target.value)}>
                <option value="">Select</option>
                <option value="1">YES</option>
                <option value="2">NO</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Policy amount STT</span>
              <input inputMode="decimal" value={policyAmount} onChange={(event) => setPolicyAmount(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Resolution market</span>
              <input inputMode="numeric" value={resolutionMarketId} onChange={(event) => setResolutionMarketId(event.target.value)} />
            </label>
            <div className="asset-readout">
              <span>Resolution fee</span>
              <strong>{formatNative(resolutionCost)}</strong>
            </div>
          </div>
          <div className="form-actions">
            <span className="form-feedback">Native credit {formatNative(nativeCredit)}</span>
            <div className="form-actions__buttons">
              <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onStake}>
                stake wallet
              </button>
              <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onStakeFromCredit}>
                stake credit
              </button>
              <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onExecutePolicy}>
                execute policy
              </button>
              <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onClaim}>
                claim
              </button>
              <button
                type="button"
                className="cta"
                disabled={isPending || !contractEnabled || typeof resolutionCost !== "bigint"}
                onClick={onRequestResolution}
              >
                resolve
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid-2 market-console__grid">
        <section className="panel">
          <div className="panel__head">
            <div>
              <p className="label">Live contract read</p>
              <strong>Selected market</strong>
            </div>
          </div>
          <div className="panel__body">
            {selectedMarketView ? (
              <dl className="kv">
                <dt className="kv__k">Creator</dt>
                <dd className="kv__v">{shortAddress(selectedMarketView.creator)}</dd>
                <dt className="kv__k">Question</dt>
                <dd className="kv__v">{selectedMarketView.question}</dd>
                <dt className="kv__k">Status</dt>
                <dd className="kv__v">{labelFrom(marketStatusLabels, selectedMarketView.status)}</dd>
                <dt className="kv__k">Outcome</dt>
                <dd className="kv__v">{labelFrom(sideLabels, selectedMarketView.outcome)}</dd>
                <dt className="kv__k">Pools</dt>
                <dd className="kv__v">
                  YES {formatNative(marketPools?.[0] ?? selectedMarketView.yesPool)} / NO{" "}
                  {formatNative(marketPools?.[1] ?? selectedMarketView.noPool)}
                </dd>
                <dt className="kv__k">Position</dt>
                <dd className="kv__v">
                  YES {formatNative(position?.[0])} / NO {formatNative(position?.[1])}
                </dd>
                <dt className="kv__k">Resolution</dt>
                <dd className="kv__v">{selectedMarketView.resolutionOutput || "empty on-chain output"}</dd>
                <dt className="kv__k">Receipt</dt>
                <dd className="kv__v">
                  {receiptHref(selectedMarketView.resolutionReceipt) ? (
                    <a href={receiptHref(selectedMarketView.resolutionReceipt)} target="_blank" rel="noopener noreferrer">
                      receipt {selectedMarketView.resolutionReceipt.toString()} <ExternalLink aria-hidden size={12} />
                    </a>
                  ) : (
                    "not read"
                  )}
                </dd>
              </dl>
            ) : (
              <p className="panel-state">Enter a market id to read contract state.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <p className="label">Live contract read</p>
              <strong>Selected action</strong>
            </div>
            <input
              className="market-console__action-input"
              inputMode="numeric"
              value={selectedActionId}
              onChange={(event) => setSelectedActionId(event.target.value)}
              placeholder="action id"
            />
          </div>
          <div className="panel__body">
            {selectedActionView ? (
              <dl className="kv">
                <dt className="kv__k">Market</dt>
                <dd className="kv__v">{selectedActionView.marketId.toString()}</dd>
                <dt className="kv__k">Actor</dt>
                <dd className="kv__v">{shortAddress(selectedActionView.actor)}</dd>
                <dt className="kv__k">Trader</dt>
                <dd className="kv__v">{shortAddress(selectedActionView.trader)}</dd>
                <dt className="kv__k">Kind</dt>
                <dd className="kv__v">{labelFrom(actionKindLabels, selectedActionView.kind)}</dd>
                <dt className="kv__k">Side</dt>
                <dd className="kv__v">{labelFrom(sideLabels, selectedActionView.side)}</dd>
                <dt className="kv__k">Amount</dt>
                <dd className="kv__v">{formatNative(selectedActionView.amount)}</dd>
                <dt className="kv__k">Policy</dt>
                <dd className="kv__v">{selectedActionView.policyId.toString()}</dd>
                <dt className="kv__k">Request</dt>
                <dd className="kv__v">{selectedActionView.requestId.toString()}</dd>
              </dl>
            ) : (
              <p className="panel-state">Enter an action id after a market action exists.</p>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="label">Recent on-chain logs</p>
            <strong>Market events</strong>
          </div>
        </div>
        <div className="panel__body">
          {logsError ? <p className="panel-state panel-state--error">{logsError}</p> : null}
          {!logsError && logRows.length === 0 ? (
            <p className="panel-state">No matching contract logs in the latest scanned block range.</p>
          ) : (
            <div className="log-list">
              {logRows.map((row) => (
                <div className="log-row" key={row.key}>
                  <span className="log-row__stat">{row.kind}</span>
                  <span className="log-row__id">{row.label}</span>
                  <span className="log-row__amt">{row.detail}</span>
                  {row.href ? (
                    <a className="log-row__addr" href={row.href} target="_blank" rel="noopener noreferrer">
                      receipt
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__body market-console__meta">
          <span>Somnia agents {shortAddress(typeof platformAddress === "string" ? platformAddress : undefined)}</span>
          <span>Parse agent {parseAgentId?.toString() ?? "not read"}</span>
          <span>Subcommittee {subcommitteeSize?.toString() ?? "not read"}</span>
        </div>
      </section>

      {feedback ? <p className="market-console__feedback">{feedback}</p> : null}
    </section>
  );
}
