"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, ShieldCheck, WalletCards } from "lucide-react";
import { formatEther, isAddress, parseEther, type Address } from "viem";
import {
  marketStatusLabels,
  predictionMarketAbi,
  predictionMarketAddress,
  predictionMarketConfigured,
  sideLabels,
  somniaReceiptsBaseUrl,
} from "@/lib/predictionMarket";
import { useWallet } from "@/lib/wallet";

type MarketContractTuple = readonly [
  Address,
  string,
  string,
  string,
  bigint,
  boolean,
  number,
  number,
  number,
  number,
  bigint,
  bigint,
  bigint,
  bigint,
  string,
  number,
  bigint,
];

type MarketRow = {
  id: number;
  creator: Address;
  question: string;
  evidenceUrl: string;
  status: number;
  outcome: number;
  yesPool: bigint;
  noPool: bigint;
  resolutionReceipt: bigint;
  resolutionOutput: string;
  closeTime: bigint;
};

type ActiveMarketTask = "trade" | "resolve" | "create" | "policy";

type WriteContractInput = {
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

const marketSourcePresets = [
  {
    id: "ucl-final-result",
    label: "Champions League final result",
    question: "Did the referenced football match finish level at full time?",
    resolutionPrompt:
      "Read the referenced match report and return exactly YES if full time ended level before penalties, otherwise return NO.",
    evidenceUrl: "https://www.uefa.com/uefachampionsleague/",
    resolveUrl: false,
    numPages: 2,
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
  if (typeof value !== "bigint") return "not read";
  const [whole, decimals = ""] = formatEther(value).split(".");
  const trimmed = decimals.slice(0, 6).replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""} STT`;
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

export default function AgentMarketApp() {
  const { address, isConnected, publicClient, walletClient } = useWallet();
  const [isPending, setIsPending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [activeTask, setActiveTask] = useState<ActiveMarketTask>("trade");

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

  const [feedback, setFeedback] = useState("");
  const [marketCount, setMarketCount] = useState<bigint>();
  const [nativeCredit, setNativeCredit] = useState<bigint>();
  const [selectedMarket, setSelectedMarket] = useState<MarketContractTuple>();
  const [marketPools, setMarketPools] = useState<readonly [bigint, bigint]>();
  const [position, setPosition] = useState<readonly [bigint, bigint]>();
  const [resolutionCost, setResolutionCost] = useState<bigint>();
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [marketsError, setMarketsError] = useState("");
  const [marketsLoading, setMarketsLoading] = useState(false);

  const contractEnabled = predictionMarketConfigured && Boolean(predictionMarketAddress);

  const marketIdForRead = useMemo(() => {
    const parsed = Number.parseInt(marketId, 10);
    return Number.isInteger(parsed) && parsed > 0 ? BigInt(parsed) : undefined;
  }, [marketId]);

  const loadContractSnapshot = useCallback(async () => {
    if (!predictionMarketAddress) return undefined;

    const [quote, count] = await Promise.all([
      publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "quoteResolutionCost",
      }),
      publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "marketCount",
      }),
    ]);

    setResolutionCost((quote as readonly [bigint, bigint, bigint])[2]);
    setMarketCount(count as bigint);

    if (address) {
      const credit = (await publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "nativeCredits",
        args: [address],
      })) as bigint;
      setNativeCredit(credit);
    } else {
      setNativeCredit(undefined);
    }

    return count as bigint;
  }, [address, publicClient]);

  const loadSelectedMarket = useCallback(async () => {
    if (!predictionMarketAddress || !marketIdForRead) {
      setSelectedMarket(undefined);
      setMarketPools(undefined);
      setPosition(undefined);
      return;
    }

    const [market, pools, userPosition] = await Promise.all([
      publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "markets",
        args: [marketIdForRead],
      }),
      publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "marketPools",
        args: [marketIdForRead],
      }),
      address
        ? publicClient.readContract({
            address: predictionMarketAddress,
            abi: predictionMarketAbi,
            functionName: "positionOf",
            args: [marketIdForRead, address],
          })
        : undefined,
    ]);

    setSelectedMarket(market as MarketContractTuple);
    setMarketPools(pools as readonly [bigint, bigint]);
    setPosition(userPosition as readonly [bigint, bigint] | undefined);
  }, [address, marketIdForRead, publicClient]);

  const loadMarkets = useCallback(
    async (countValue = marketCount) => {
      if (!publicClient || !predictionMarketAddress || typeof countValue !== "bigint" || countValue === 0n) {
        setMarketRows([]);
        setMarketsLoading(false);
        return;
      }

      setMarketsError("");
      setMarketsLoading(true);
      try {
        const contractAddress = predictionMarketAddress;
        const count = Number(countValue);
        const first = Math.max(1, count - 11);
        const ids = Array.from({ length: count - first + 1 }, (_, index) => count - index);
        const rows = await Promise.all(
          ids.map(async (id) => {
            const data = (await publicClient.readContract({
              address: contractAddress,
              abi: predictionMarketAbi,
              functionName: "markets",
              args: [BigInt(id)],
            })) as MarketContractTuple;

            return {
              id,
              creator: data[0],
              question: data[1],
              evidenceUrl: data[3],
              closeTime: data[4],
              status: data[8],
              outcome: data[9],
              yesPool: data[10],
              noPool: data[11],
              resolutionReceipt: data[13],
              resolutionOutput: data[14],
            };
          }),
        );
        setMarketRows(rows);
      } catch {
        setMarketsError("Could not load markets from the deployed contract.");
      } finally {
        setMarketsLoading(false);
      }
    },
    [marketCount, publicClient],
  );

  useEffect(() => {
    setRevealed(true);
  }, []);

  useEffect(() => {
    void loadContractSnapshot().then((count) => loadMarkets(count));
  }, [loadContractSnapshot, loadMarkets]);

  useEffect(() => {
    void loadSelectedMarket();
  }, [loadSelectedMarket]);

  useEffect(() => {
    if (!marketId && marketRows[0]) {
      setMarketId(marketRows[0].id.toString());
    }
  }, [marketId, marketRows]);

  function selectMarket(id: number) {
    setMarketId(id.toString());
    setActiveTask("trade");
  }

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

  async function writeMarketContract({ args, functionName, value }: WriteContractInput) {
    if (!predictionMarketAddress || !walletClient || !address) {
      throw new Error("Connect a wallet first.");
    }

    setIsPending(true);
    try {
      const hash = await walletClient.writeContract({
        account: address,
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName,
        args,
        value,
      } as unknown as Parameters<typeof walletClient.writeContract>[0]);
      return await publicClient.waitForTransactionReceipt({ hash });
    } finally {
      setIsPending(false);
    }
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

      const receipt = await writeMarketContract({
        functionName: "createMarket",
        args: [question.trim(), resolutionPrompt.trim(), evidenceUrl.trim(), closeTime, resolveUrl, pages, confidence],
      });
      const nextMarketCount = await publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "marketCount",
      });
      setMarketCount(nextMarketCount as bigint);
      setMarketId(nextMarketCount.toString());
      setActiveTask("trade");
      setFeedback(`Market created in block ${receipt.blockNumber.toString()}.`);
      await loadMarkets(nextMarketCount as bigint);
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

      const receipt = await writeMarketContract({
        functionName: "createPolicy",
        args: [executorAddress as Address, side, maxStakePerAction, maxTotal, expiresAt],
      });
      const nextPolicyCount = await publicClient.readContract({
        address: predictionMarketAddress,
        abi: predictionMarketAbi,
        functionName: "policyCount",
      });
      setPolicyId(nextPolicyCount.toString());
      setFeedback(`Policy created in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
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
      const receipt = await writeMarketContract({
        functionName: "depositCredit",
        value,
      });
      setFeedback(`Credit deposited in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
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
      const receipt = await writeMarketContract({
        functionName: "withdrawCredit",
        args: [amount],
      });
      setFeedback(`Credit withdrawn in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
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
      const receipt = await writeMarketContract({
        functionName: "disablePolicy",
        args: [BigInt(parsedPolicyId)],
      });
      setFeedback(`Policy disabled in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
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
      const receipt = await writeMarketContract({
        functionName: "stake",
        value,
        args: [BigInt(parsedMarketId), side],
      });
      setFeedback(`Stake recorded in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
      await loadSelectedMarket();
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
      const receipt = await writeMarketContract({
        functionName: "stakeFromCredit",
        args: [BigInt(parsedMarketId), side, amount],
      });
      setFeedback(`Credit stake recorded in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
      await loadSelectedMarket();
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
      const receipt = await writeMarketContract({
        functionName: "executePolicy",
        args: [BigInt(parsedPolicyId), BigInt(parsedMarketId), side, amount],
      });
      setFeedback(`Policy execution recorded in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
      await loadSelectedMarket();
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
      const parsedMarketId = parsePositiveInteger(marketId, "Market ID");
      const receipt = await writeMarketContract({
        functionName: "requestResolution",
        value: resolutionCost,
        args: [BigInt(parsedMarketId)],
      });
      setFeedback(`Resolution requested in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
      await loadSelectedMarket();
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
      const receipt = await writeMarketContract({
        functionName: "claim",
        args: [BigInt(parsedMarketId)],
      });
      setFeedback(`Claim submitted in block ${receipt.blockNumber.toString()}.`);
      await loadContractSnapshot();
      await loadMarkets();
      await loadSelectedMarket();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Claim failed.");
    }
  }

  const selectedMarketView = selectedMarket
    ? {
        question: selectedMarket[1],
        evidenceUrl: selectedMarket[3],
        status: selectedMarket[8],
        outcome: selectedMarket[9],
        yesPool: selectedMarket[10],
        noPool: selectedMarket[11],
        resolutionReceipt: selectedMarket[13],
        resolutionOutput: selectedMarket[14],
      }
    : undefined;

  const selectedMarketRow = marketRows.find((market) => market.id.toString() === marketId);
  const selectedQuestion = selectedMarketView?.question ?? selectedMarketRow?.question;
  const selectedEvidenceUrl = selectedMarketView?.evidenceUrl ?? selectedMarketRow?.evidenceUrl;
  const selectedStatus = selectedMarketView?.status ?? selectedMarketRow?.status;
  const selectedOutcome = selectedMarketView?.outcome ?? selectedMarketRow?.outcome;
  const selectedYesPool = marketPools?.[0] ?? selectedMarketView?.yesPool ?? selectedMarketRow?.yesPool;
  const selectedNoPool = marketPools?.[1] ?? selectedMarketView?.noPool ?? selectedMarketRow?.noPool;
  const selectedReceipt = selectedMarketView?.resolutionReceipt ?? selectedMarketRow?.resolutionReceipt;
  const selectedOutput = selectedMarketView?.resolutionOutput ?? selectedMarketRow?.resolutionOutput;
  const taskTabId = `market-task-${activeTask}`;

  return (
    <section
      className="market-app t-panel-slide"
      data-open={revealed ? "true" : "false"}
      aria-label="Agentic prediction market"
    >
      <header className="market-app__head market-app__head--compact">
        <div>
          <p className="eyebrow">Somnia Markets</p>
          <h1 className="display">Agent-watched markets</h1>
          <p className="market-app__lede">Choose a live market, then run one action at a time.</p>
        </div>
      </header>

      <div className="market-workbench">
        <section className="panel market-list-panel" aria-label="Markets">
          <div className="panel__head">
            <div>
              <p className="label">Markets</p>
              <strong>Live from contract</strong>
            </div>
          </div>
          <div className="panel__body">
            {marketsError ? <p className="panel-state panel-state--error">{marketsError}</p> : null}
            {!marketsError && marketsLoading ? <p className="panel-state">Loading markets.</p> : null}
            {!marketsError && !marketsLoading && marketRows.length === 0 ? (
              <p className="panel-state">No markets found on the deployed contract.</p>
            ) : null}
            {!marketsError && !marketsLoading && marketRows.length > 0 ? (
              <div className="market-list">
                {marketRows.map((market) => {
                  const selected = market.id.toString() === marketId;
                  return (
                    <article className="market-row-card" data-selected={selected ? "true" : "false"} key={market.id}>
                      <div className="market-row-card__main">
                        <div className="market-row-card__top">
                          <span className="market-row-card__id">Market {market.id}</span>
                          <span className="market-row-card__status">{labelFrom(marketStatusLabels, market.status)}</span>
                        </div>
                        <h2>{market.question}</h2>
                        <div className="market-row-card__meta">
                          <span>YES {formatNative(market.yesPool)}</span>
                          <span>NO {formatNative(market.noPool)}</span>
                          <span>{labelFrom(sideLabels, market.outcome)}</span>
                        </div>
                      </div>
                      <div className="market-row-card__side">
                        <a href={market.evidenceUrl} target="_blank" rel="noopener noreferrer">
                          Source <ExternalLink aria-hidden size={12} />
                        </a>
                        {receiptHref(market.resolutionReceipt) ? (
                          <a href={receiptHref(market.resolutionReceipt)} target="_blank" rel="noopener noreferrer">
                            Receipt <ExternalLink aria-hidden size={12} />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="cta cta--ghost"
                          aria-pressed={selected}
                          onClick={() => selectMarket(market.id)}
                        >
                          {selected ? "Selected" : "Select"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel market-action-panel" aria-label="Market actions">
          <div className="panel__head market-action-panel__head">
            <div>
              <p className="label">Selected market</p>
              <strong>{marketId ? `Market ${marketId}` : "Pick a market"}</strong>
            </div>
          </div>

          <div className="panel__body">
            <div className="selected-market">
              {selectedQuestion ? (
                <>
                  <div className="selected-market__top">
                    <span>{labelFrom(marketStatusLabels, selectedStatus)}</span>
                    {selectedOutput ? <span>Result {selectedOutput}</span> : null}
                  </div>
                  <h2>{selectedQuestion}</h2>
                  <div className="selected-market__meta">
                    <span>YES {formatNative(selectedYesPool)}</span>
                    <span>NO {formatNative(selectedNoPool)}</span>
                    <span>Outcome {labelFrom(sideLabels, selectedOutcome)}</span>
                    {position ? (
                      <span>
                        Your position YES {formatNative(position[0])} / NO {formatNative(position[1])}
                      </span>
                    ) : null}
                  </div>
                  <div className="selected-market__links">
                    {selectedEvidenceUrl ? (
                      <a href={selectedEvidenceUrl} target="_blank" rel="noopener noreferrer">
                        Source <ExternalLink aria-hidden size={12} />
                      </a>
                    ) : null}
                    {receiptHref(selectedReceipt) ? (
                      <a href={receiptHref(selectedReceipt)} target="_blank" rel="noopener noreferrer">
                        Receipt <ExternalLink aria-hidden size={12} />
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="panel-state">Select a market to trade or resolve.</p>
              )}
            </div>

            <div className="market-task-tabs" role="tablist" aria-label="Market workflow">
              <button
                type="button"
                className="market-task-tab"
                data-active={activeTask === "trade" ? "true" : "false"}
                role="tab"
                aria-selected={activeTask === "trade"}
                aria-controls="market-task-trade"
                onClick={() => setActiveTask("trade")}
              >
                Trade
              </button>
              <button
                type="button"
                className="market-task-tab"
                data-active={activeTask === "resolve" ? "true" : "false"}
                role="tab"
                aria-selected={activeTask === "resolve"}
                aria-controls="market-task-resolve"
                onClick={() => setActiveTask("resolve")}
              >
                Resolve
              </button>
              <button
                type="button"
                className="market-task-tab"
                data-active={activeTask === "create" ? "true" : "false"}
                role="tab"
                aria-selected={activeTask === "create"}
                aria-controls="market-task-create"
                onClick={() => setActiveTask("create")}
              >
                Create
              </button>
              <button
                type="button"
                className="market-task-tab"
                data-active={activeTask === "policy" ? "true" : "false"}
                role="tab"
                aria-selected={activeTask === "policy"}
                aria-controls="market-task-policy"
                onClick={() => setActiveTask("policy")}
              >
                Policy
              </button>
            </div>

            {activeTask === "trade" ? (
              <div className="market-task-panel" id={taskTabId} role="tabpanel">
                <div className="task-block">
                  <div className="task-block__head">
                    <WalletCards aria-hidden size={18} />
                    <strong>Stake</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span className="label">Market</span>
                      <input inputMode="numeric" value={marketId} onChange={(event) => setMarketId(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Side</span>
                      <select value={stakeSide} onChange={(event) => setStakeSide(event.target.value)}>
                        <option value="">Choose side</option>
                        <option value="1">YES</option>
                        <option value="2">NO</option>
                      </select>
                    </label>
                    <label className="field field--wide">
                      <span className="label">Amount STT</span>
                      <input inputMode="decimal" value={stakeAmount} onChange={(event) => setStakeAmount(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <span className="form-feedback">Credit {formatNative(nativeCredit)}</span>
                    <div className="form-actions__buttons">
                      <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onStakeFromCredit}>
                        Stake credit
                      </button>
                      <button type="button" className="cta" disabled={isPending || !contractEnabled} onClick={onStake}>
                        Stake wallet
                      </button>
                      <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onClaim}>
                        Claim
                      </button>
                    </div>
                  </div>
                </div>

                <div className="task-block task-block--split">
                  <div className="task-block__head">
                    <ShieldCheck aria-hidden size={18} />
                    <strong>Policy order</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span className="label">Policy</span>
                      <input inputMode="numeric" value={policyId} onChange={(event) => setPolicyId(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Side</span>
                      <select value={policySide} onChange={(event) => setPolicySide(event.target.value)}>
                        <option value="">Choose side</option>
                        <option value="1">YES</option>
                        <option value="2">NO</option>
                      </select>
                    </label>
                    <label className="field field--wide">
                      <span className="label">Amount STT</span>
                      <input inputMode="decimal" value={policyAmount} onChange={(event) => setPolicyAmount(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button type="button" className="cta" disabled={isPending || !contractEnabled} onClick={onExecutePolicy}>
                      Use policy
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTask === "resolve" ? (
              <div className="market-task-panel" id={taskTabId} role="tabpanel">
                <div className="task-block">
                  <div className="task-block__head">
                    <ShieldCheck aria-hidden size={18} />
                    <strong>Resolve market</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span className="label">Market</span>
                      <input inputMode="numeric" value={marketId} onChange={(event) => setMarketId(event.target.value)} />
                    </label>
                    <div className="asset-readout">
                      <span>Fee</span>
                      <strong>{formatNative(resolutionCost)}</strong>
                    </div>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button
                      type="button"
                      className="cta"
                      disabled={isPending || !contractEnabled || typeof resolutionCost !== "bigint"}
                      onClick={onRequestResolution}
                    >
                      Request resolution
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTask === "create" ? (
              <form className="market-task-panel" id={taskTabId} role="tabpanel" onSubmit={onCreateMarket}>
                <div className="task-block">
                  <div className="task-block__head">
                    <Plus aria-hidden size={18} />
                    <strong>Create market</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field field--wide">
                      <span className="label">Source preset</span>
                      <select value={sourceId} onChange={(event) => onSelectMarketSource(event.target.value)}>
                        {marketSourcePresets.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="source-card field--wide">
                      <span className="label">Question</span>
                      <strong>{question}</strong>
                      <a href={evidenceUrl} target="_blank" rel="noopener noreferrer">
                        Source <ExternalLink aria-hidden size={12} />
                      </a>
                    </div>
                    <details className="source-details field--wide">
                      <summary>Resolution rules</summary>
                      <p>{resolutionPrompt}</p>
                    </details>
                    <label className="field">
                      <span className="label">Close days</span>
                      <input inputMode="numeric" value={closeDays} onChange={(event) => setCloseDays(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button type="submit" className="cta" disabled={isPending || !contractEnabled}>
                      Create market
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {activeTask === "policy" ? (
              <form className="market-task-panel" id={taskTabId} role="tabpanel" onSubmit={onCreatePolicy}>
                <div className="task-block">
                  <div className="task-block__head">
                    <ShieldCheck aria-hidden size={18} />
                    <strong>Policy limits</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field field--wide">
                      <span className="label">Executor</span>
                      <input value={executor} onChange={(event) => setExecutor(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Allowed side</span>
                      <select value={allowedSide} onChange={(event) => setAllowedSide(event.target.value)}>
                        <option value="">Choose side</option>
                        <option value="0">Any</option>
                        <option value="1">YES</option>
                        <option value="2">NO</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">Expiry days</span>
                      <input inputMode="numeric" value={policyExpiryDays} onChange={(event) => setPolicyExpiryDays(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Max stake</span>
                      <input inputMode="decimal" value={maxStake} onChange={(event) => setMaxStake(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Max total</span>
                      <input inputMode="decimal" value={maxTotalStake} onChange={(event) => setMaxTotalStake(event.target.value)} />
                    </label>
                    <label className="field field--wide">
                      <span className="label">Credit amount STT</span>
                      <input inputMode="decimal" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <span className="form-feedback">Credit {formatNative(nativeCredit)}</span>
                    <div className="form-actions__buttons">
                      <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onWithdrawCredit}>
                        Withdraw
                      </button>
                      <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onDepositCredit}>
                        Deposit
                      </button>
                      <button type="button" className="cta cta--ghost" disabled={isPending || !contractEnabled} onClick={onDisablePolicy}>
                        Disable
                      </button>
                      <button type="submit" className="cta" disabled={isPending || !contractEnabled}>
                        Create policy
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </div>

      {feedback ? <p className="market-app__feedback">{feedback}</p> : null}
    </section>
  );
}
