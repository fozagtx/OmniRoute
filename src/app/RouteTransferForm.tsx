"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatEther, parseUnits, type Address } from "viem";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { escrowAbi, escrowAddress, escrowConfigured } from "@/lib/escrow";
import {
  getDefaultTokenSymbol,
  getTokenAddress,
  getTokenBySymbol,
  tokenConfigured,
  tokenOptions,
} from "@/lib/tokens";

const quoteOptions = [
  { code: "EUR", label: "EUR", pair: "USDC / EUR" },
] as const;
type QuoteCode = (typeof quoteOptions)[number]["code"];
const supportedQuoteCode: QuoteCode = "EUR";

const rateConfigByQuote: Record<QuoteCode, { url: string; jsonPath: string }> = {
  EUR: { url: "https://api.coinbase.com/v2/exchange-rates?currency=USDC", jsonPath: "data.rates.EUR" },
};

const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const erc20MetadataAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

type SettlementNodeData = {
  amount: string;
  assetReady: boolean;
  canUseEscrow: boolean;
  destinationAccount: string;
  feeText: string;
  feedback: string;
  isConnected: boolean;
  isPending: boolean;
  minOut: string;
  quoteCode: string;
  rateSourceReady: boolean;
  settlementVaultText: string;
  tokenSymbol: string;
  onApprove: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onTokenChange: (value: string) => void;
  setAmount: (value: string) => void;
  setDestinationAccount: (value: string) => void;
  setMinOut: (value: string) => void;
};

type AutomationNodeData = {
  assetReady: boolean;
  connected: boolean;
  destinationAccountReady: boolean;
  feedback: string;
  isPending: boolean;
  canScheduleEscrow: boolean;
  maxChecks: string;
  rateJsonPath: string;
  rateSourceReady: boolean;
  rateSourceVerified: boolean;
  rateUrl: string;
  revealed: boolean;
  settlementPair: string;
  targetRate: string;
  onRun: () => void;
  setMaxChecks: (value: string) => void;
  setTargetRate: (value: string) => void;
};

type SettlementNode = Node<SettlementNodeData, "settlement">;
type AutomationNode = Node<AutomationNodeData, "automation">;

function SettlementCardNode({ data }: NodeProps<SettlementNode>) {
  const quoteCode = data.quoteCode ?? quoteOptions[0].code;
  const destinationAccountReady = Boolean(data.destinationAccount.trim());

  return (
    <form className="flow-node-card settlement-node" onSubmit={data.onSubmit}>
      <Handle type="source" position={Position.Right} />
      <div className="flow-node-card__head">
        <span className="label">settlement</span>
        <strong>Start transfer</strong>
      </div>
      <div className="node-form-grid">
        <label className="field">
          <span className="label">asset</span>
          <select
            className="nodrag"
            value={data.tokenSymbol ?? getDefaultTokenSymbol()}
            onChange={(event) => data.onTokenChange?.(event.target.value)}
          >
            {tokenOptions.map((option) => (
              <option value={option.symbol} key={option.symbol}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">amount</span>
          <input
            className="mono numeric nodrag"
            value={data.amount ?? ""}
            onChange={(event) => data.setAmount?.(event.target.value)}
            inputMode="decimal"
            placeholder="0.0"
            required
          />
        </label>
        <label className="field">
          <span className="label">minimum output</span>
          <input
            className="mono numeric nodrag"
            value={data.minOut ?? ""}
            onChange={(event) => data.setMinOut?.(event.target.value)}
            inputMode="decimal"
            placeholder="0.0"
            required
          />
        </label>
        <label className="field">
          <span className="label">pair</span>
          <select className="nodrag" value={quoteCode} onChange={() => undefined}>
            {quoteOptions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.pair}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--wide">
          <span className="label">destination account</span>
          <input
            className="mono nodrag"
            value={data.destinationAccount}
            onChange={(event) => data.setDestinationAccount(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
      </div>
      <div className="node-note node-note--stack">
        <span>
          <span>Off-ramp vault</span>
          <span className="mono">{data.settlementVaultText ?? "vault loading"}</span>
        </span>
        <span>
          <span>Agent fee</span>
          <span className="mono">{data.feeText ?? "fee quote loading"}</span>
        </span>
      </div>
      <div className="node-actions node-actions--settlement">
        <span className={`label form-feedback ${data.feedback ? "form-feedback--active" : ""}`}>
          {data.feedback || "ready"}
        </span>
        <div className="settlement-actions">
          <button
            type="button"
            className="settlement-action settlement-action--secondary nodrag"
            disabled={!data.isConnected || data.isPending || !data.assetReady}
            onClick={data.onApprove}
          >
            <span className="settlement-action__step">1</span>
            <span className="settlement-action__copy">
              <strong>Allow USDC</strong>
              <small>Wallet permission</small>
            </span>
          </button>
          <button
            type="submit"
            className="settlement-action settlement-action--primary nodrag"
            disabled={
              !data.isConnected ||
              data.isPending ||
              !data.canUseEscrow ||
              !data.assetReady ||
              !data.rateSourceReady ||
              !destinationAccountReady
            }
          >
            <span className="settlement-action__step">2</span>
            <span className="settlement-action__copy">
              <strong>{data.isPending ? "Submitting" : "Start transfer"}</strong>
              <small>Escrow request</small>
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}

function AutomationCardNode({ data }: NodeProps<AutomationNode>) {
  return (
    <section className="flow-node-card automation-node t-panel-slide" data-open={data.revealed ? "true" : "false"} aria-hidden={!data.revealed}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-node-card__head">
        <span className="label">automation</span>
        <strong>Rate check</strong>
      </div>
      <div className="node-form-grid">
        <label className="field">
          <span className="label">target rate</span>
          <input
            className="mono numeric nodrag"
            value={data.targetRate ?? ""}
            onChange={(event) => data.setTargetRate?.(event.target.value)}
            inputMode="decimal"
            placeholder="1.00"
          />
        </label>
        <label className="field">
          <span className="label">max checks</span>
          <input
            className="mono numeric nodrag"
            value={data.maxChecks ?? "5"}
            onChange={(event) => data.setMaxChecks?.(event.target.value)}
            inputMode="numeric"
            placeholder="5"
          />
        </label>
        <div className="node-note">
          <span>Pair</span>
          <span className="mono">{data.settlementPair ?? "USDC / EUR"}</span>
        </div>
        <div className="node-note">
          <span>Source</span>
          <span className="mono">{data.rateUrl.includes("coinbase.com") ? "Coinbase" : "Unknown"}</span>
        </div>
        <div className="node-note">
          <span>Selector</span>
          <span className="mono">{data.rateJsonPath}</span>
        </div>
        <div className="node-note">
          <span>Status</span>
          <span className="mono">{data.rateSourceVerified ? "verified" : "checking"}</span>
        </div>
      </div>
      <div className="node-actions">
        <span className="label form-feedback">{data.feedback}</span>
        <button
          type="button"
          className="cta nodrag"
          disabled={
            !data.connected ||
            data.isPending ||
            !data.assetReady ||
            !data.destinationAccountReady ||
            !data.rateSourceReady ||
            !data.canScheduleEscrow
          }
          onClick={data.onRun}
        >
          {data.isPending ? "submitting" : "run"}
        </button>
      </div>
    </section>
  );
}

const nodeTypes = {
  settlement: SettlementCardNode,
  automation: AutomationCardNode,
};

const defaultEdgeOptions = { animated: true, type: "smoothstep" } as const;

const noop = () => {};
const noopSubmit = (event: React.FormEvent) => event.preventDefault();

const initialSettlementData: SettlementNodeData = {
  amount: "",
  assetReady: false,
  canUseEscrow: false,
  destinationAccount: "",
  feeText: "fee quote loading",
  feedback: "",
  isConnected: false,
  isPending: false,
  minOut: "",
  quoteCode: quoteOptions[0].code,
  rateSourceReady: false,
  settlementVaultText: "vault loading",
  tokenSymbol: getDefaultTokenSymbol(),
  onApprove: noop,
  onSubmit: noopSubmit,
  onTokenChange: noop,
  setAmount: noop,
  setDestinationAccount: noop,
  setMinOut: noop,
};

const initialAutomationData: AutomationNodeData = {
  assetReady: false,
  connected: false,
  destinationAccountReady: false,
  feedback: "Connect settlement to automation.",
  isPending: false,
  canScheduleEscrow: false,
  maxChecks: "5",
  rateJsonPath: "data.rates.EUR",
  rateSourceReady: false,
  rateSourceVerified: false,
  rateUrl: "https://api.coinbase.com/v2/exchange-rates?currency=USDC",
  revealed: false,
  settlementPair: "USDC / EUR",
  targetRate: "",
  onRun: noop,
  setMaxChecks: noop,
  setTargetRate: noop,
};

function readJsonPath(payload: unknown, selector: string) {
  const normalized = selector.trim().replace(/^\$\./, "");
  if (!normalized) return undefined;

  return normalized.split(".").reduce<unknown>((value, key) => {
    if (value === null || typeof value === "undefined") return undefined;
    if (/^\d+$/.test(key) && Array.isArray(value)) {
      return value[Number.parseInt(key, 10)];
    }
    if (typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function readPositiveRate(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const initialNodes: Array<SettlementNode | AutomationNode> = [
  { id: "settlement", type: "settlement", position: { x: 40, y: 90 }, data: initialSettlementData },
  { id: "automation", type: "automation", position: { x: 500, y: 90 }, data: initialAutomationData },
];

export default function RouteTransferForm() {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [canvasRevealed, setCanvasRevealed] = useState(false);
  const { data: quoteCost } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: "quoteTotalCost",
    query: { enabled: escrowConfigured },
  });
  const { data: offRampVault } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: "offRampVault",
    query: { enabled: escrowConfigured },
  });

  const [tokenSymbol, setTokenSymbol] = useState(getDefaultTokenSymbol());
  const selectedToken = getTokenBySymbol(tokenSymbol);
  const token = tokenConfigured(selectedToken) ? getTokenAddress(selectedToken) : undefined;
  const { data: onchainTokenDecimals } = useReadContract({
    address: token,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    query: { enabled: Boolean(token) },
  });
  const [amount, setAmount] = useState("");
  const [minOut, setMinOut] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("");
  const initialQuoteCode = supportedQuoteCode;
  const initialRateConfig = rateConfigByQuote[initialQuoteCode];
  const quoteCode = initialQuoteCode;
  const [rateUrl, setRateUrl] = useState(initialRateConfig.url);
  const [rateJsonPath, setRateJsonPath] = useState(initialRateConfig.jsonPath);
  const [rateSourceVerified, setRateSourceVerified] = useState(false);
  const [targetRate, setTargetRate] = useState("");
  const [maxChecks, setMaxChecks] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [automationFeedback, setAutomationFeedback] = useState("Connect settlement to automation.");
  const parsedMaxChecks = Number.parseInt(maxChecks, 10);
  const quoteMaxChecks = Number.isInteger(parsedMaxChecks) && parsedMaxChecks > 0 ? BigInt(parsedMaxChecks) : undefined;
  const { data: scheduledQuote, error: scheduledQuoteError } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: "quoteScheduledTransferCost",
    args: quoteMaxChecks ? [quoteMaxChecks] : undefined,
    query: { enabled: escrowConfigured && Boolean(quoteMaxChecks) },
  });

  const totalCost = quoteCost?.[3] ?? 0n;
  const scheduledCost = scheduledQuote?.[3] ?? 0n;
  const canUseEscrow = escrowConfigured && totalCost > 0n;
  const canScheduleEscrow = escrowConfigured && scheduledCost > 0n && !scheduledQuoteError;
  const assetReady = tokenConfigured(selectedToken);
  const tokenDecimals = typeof onchainTokenDecimals === "number" ? onchainTokenDecimals : undefined;
  const resolvedQuoteCode = supportedQuoteCode;
  const selectedRateConfig = rateConfigByQuote[resolvedQuoteCode];
  const rateSourceReady = Boolean(rateUrl.trim() && rateJsonPath.trim() && rateSourceVerified);
  const destinationAccountReady = Boolean(destinationAccount.trim());
  const selectedQuote = quoteOptions.find((option) => option.code === quoteCode);
  const settlementPair = selectedQuote?.pair ?? "USDC / EUR";
  const feeText = !escrowConfigured
    ? "escrow not configured"
    : quoteCost
      ? `${formatEther(totalCost)} STT`
      : "fee quote loading";
  const settlementVaultText =
    typeof offRampVault === "string" ? `${offRampVault.slice(0, 6)}...${offRampVault.slice(-4)}` : "vault loading";
  const settlementFeedback =
    feedback ||
    (!isConnected
      ? "Connect wallet to start."
      : !assetReady
        ? "USDC is not configured."
        : !destinationAccountReady
          ? "Enter destination account."
        : !canUseEscrow
          ? "Escrow fee quote loading."
          : !rateSourceReady
            ? "Checking live rate source."
            : "Ready.");

  function getResolvedTokenDecimals() {
    const d = tokenDecimals;
    if (typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 24) {
      throw new Error("Token decimals are not available from the chain.");
    }
    return d;
  }

  function parseAmountInput() {
    const d = getResolvedTokenDecimals();
    return parseUnits(amount || "0", d);
  }

  function parseMinOutInput() {
    const d = getResolvedTokenDecimals();
    return parseUnits(minOut || "0", d);
  }

  function parseMaxChecksInput() {
    const parsed = Number.parseInt(maxChecks, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("Max checks must be a positive integer.");
    }
    return BigInt(parsed);
  }

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flow, setFlow] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const layoutBucketRef = useRef<string | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const connected = edges.some((edge) => edge.source === "settlement" && edge.target === "automation");

  useEffect(() => {
    setRateUrl(selectedRateConfig.url);
    setRateJsonPath(selectedRateConfig.jsonPath);
  }, [selectedRateConfig]);

  useEffect(() => {
    const url = rateUrl.trim();
    const path = rateJsonPath.trim();
    if (!url || !path) {
      setRateSourceVerified(false);
      return;
    }

    const controller = new AbortController();
    setRateSourceVerified(false);

    async function verifyRatePath() {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          throw new Error(`rate source returned ${response.status}`);
        }
        const payload = await response.json();
        const value = readJsonPath(payload, path);
        if (readPositiveRate(value) === null) {
          throw new Error("rate path did not resolve to a positive number");
        }
        setRateSourceVerified(true);
      } catch {
        if (!controller.signal.aborted) {
          setRateSourceVerified(false);
        }
      }
    }

    void verifyRatePath();
    return () => controller.abort();
  }, [rateJsonPath, rateUrl]);

  useEffect(() => {
    setCanvasRevealed(true);
  }, []);

  useEffect(() => {
    function layoutNodes() {
      const width = window.innerWidth;
      const bucket = width <= 520 ? "mobile" : width <= 900 ? "tablet" : "desktop";
      const nextPadding = width <= 520 ? 0.08 : width <= 900 ? 0.12 : 0.18;
      if (layoutBucketRef.current !== bucket) {
        layoutBucketRef.current = bucket;
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (bucket === "mobile") {
              return {
                ...node,
                position: node.id === "settlement" ? { x: 24, y: 64 } : { x: 24, y: 700 },
              };
            }

            if (bucket === "tablet") {
              return {
                ...node,
                position: node.id === "settlement" ? { x: 32, y: 64 } : { x: 32, y: 560 },
              };
            }

            return {
              ...node,
              position: node.id === "settlement" ? { x: 40, y: 90 } : { x: 500, y: 90 },
            };
          }),
        );
      }
      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
      }
      layoutFrameRef.current = window.requestAnimationFrame(() => {
        if (width <= 900) {
          void flow?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
          return;
        }
        void flow?.fitView({ padding: nextPadding, duration: 0 });
      });
    }

    layoutNodes();
    window.addEventListener("resize", layoutNodes);
    return () => {
      window.removeEventListener("resize", layoutNodes);
      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
      }
    };
  }, [flow, setNodes]);

  const connectAutomation = useCallback(() => {
    setEdges([
      {
        id: "settlement-automation",
        source: "settlement",
        target: "automation",
        animated: true,
        type: "smoothstep",
      },
    ]);
    setAutomationFeedback("Automation connected.");
  }, [setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source !== "settlement" || connection.target !== "automation") {
        return;
      }
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: "settlement-automation",
            animated: true,
            type: "smoothstep",
          },
          currentEdges.filter((edge) => edge.id !== "settlement-automation"),
        ),
      );
      setAutomationFeedback("Automation connected.");
    },
    [setEdges],
  );

  async function onApprove() {
    setFeedback("");
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }
    if (!assetReady) {
      setFeedback("USDC is not configured.");
      return;
    }

    let amountIn: bigint;
    try {
      amountIn = parseAmountInput();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Amount is not valid.");
      return;
    }
    if (amountIn === 0n) {
      setFeedback("Enter an amount.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: token as Address,
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [escrowAddress, amountIn],
      });
      setFeedback(`USDC allowance submitted: ${hash}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "approval failed");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }
    if (!assetReady) {
      setFeedback("USDC is not configured.");
      return;
    }
    if (!canUseEscrow) {
      setFeedback("Escrow fee quote is not ready.");
      return;
    }

    let amountIn: bigint;
    let minOutVal: bigint;
    try {
      amountIn = parseAmountInput();
      minOutVal = parseMinOutInput();
    } catch {
      setFeedback("Amount or minimum output is not valid.");
      return;
    }
    if (amountIn === 0n) {
      setFeedback("Enter an amount.");
      return;
    }
    if (minOutVal === 0n) {
      setFeedback("Enter a minimum output.");
      return;
    }
    if (!destinationAccount.trim()) {
      setFeedback("Destination account is required.");
      return;
    }
    if (!resolvedQuoteCode.trim()) {
      setFeedback("Quote code is required.");
      return;
    }
    if (!rateSourceReady) {
      setFeedback("Rate URL and JSON path must resolve to a live number.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "requestTransfer",
        value: totalCost,
        args: [token as Address, amountIn, minOutVal, resolvedQuoteCode, destinationAccount.trim(), rateUrl, rateJsonPath],
      });
      setFeedback(`Transfer submitted: ${hash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "transaction failed";
      if (msg.includes("DepositorNotVerified")) {
        setFeedback("This escrow only accepts enabled wallets.");
      } else if (msg.includes("InsufficientGasDeposit")) {
        setFeedback("Not enough STT attached for the agent request.");
      } else {
        setFeedback(msg);
      }
    }
  }

  async function onRunAutomation() {
    if (!connected) {
      setAutomationFeedback("Connect the settlement card first.");
      return;
    }
    if (!isConnected) {
      setAutomationFeedback("Connect a wallet first.");
      return;
    }
    if (!assetReady) {
      setAutomationFeedback("USDC is not configured.");
      return;
    }
    if (!destinationAccountReady) {
      setAutomationFeedback("Enter destination account.");
      return;
    }
    if (!canUseEscrow) {
      setAutomationFeedback("Escrow fee quote is not ready.");
      return;
    }
    if (!canScheduleEscrow) {
      setAutomationFeedback("Scheduled transfers are not available on this deployed escrow.");
      return;
    }
    if (!rateSourceReady) {
      setAutomationFeedback("Rate URL and JSON path must resolve to a live number.");
      return;
    }
    if (!resolvedQuoteCode.trim()) {
      setAutomationFeedback("Quote code is required.");
      return;
    }

    let amountIn: bigint;
    let minOutVal: bigint;
    let targetRateVal: bigint;
    let maxChecksVal: bigint;
    try {
      amountIn = parseAmountInput();
      minOutVal = parseMinOutInput();
      targetRateVal = parseUnits(targetRate || "0", 8);
      maxChecksVal = parseMaxChecksInput();
    } catch (err) {
      setAutomationFeedback(err instanceof Error ? err.message : "Automation input is not valid.");
      return;
    }

    if (amountIn === 0n) {
      setAutomationFeedback("Enter an amount.");
      return;
    }
    if (minOutVal === 0n) {
      setAutomationFeedback("Enter a minimum output.");
      return;
    }
    if (targetRateVal === 0n) {
      setAutomationFeedback("Enter a target rate.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "createScheduledTransfer",
        value: scheduledCost,
        args: [
          token as Address,
          amountIn,
          minOutVal,
          targetRateVal,
          maxChecksVal,
          resolvedQuoteCode,
          destinationAccount.trim(),
          rateUrl,
          rateJsonPath,
        ],
      });
      setAutomationFeedback(`Scheduled transfer submitted: ${hash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "scheduled transfer failed";
      if (msg.includes("DepositorNotVerified")) {
        setAutomationFeedback("This escrow only accepts enabled wallets.");
      } else if (msg.includes("InsufficientGasDeposit")) {
        setAutomationFeedback("Not enough STT attached for the scheduled request.");
      } else {
        setAutomationFeedback(msg);
      }
    }
  }

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => {
        if (node.id === "settlement") {
          return {
            ...node,
            data: {
              amount,
              assetReady,
              canUseEscrow,
              destinationAccount,
              feeText,
              feedback: settlementFeedback,
              isConnected,
              isPending,
              minOut,
              quoteCode,
              rateSourceReady,
              settlementVaultText,
              tokenSymbol,
              onApprove,
              onSubmit,
              onTokenChange: (value: string) => {
                const nextToken = getTokenBySymbol(value);
                if (!nextToken) {
                  return;
                }
                setTokenSymbol(nextToken.symbol);
              },
              setAmount,
              setDestinationAccount,
              setMinOut,
            } satisfies SettlementNodeData,
          };
        }

        if (node.id === "automation") {
          return {
            ...node,
            data: {
              assetReady,
              canScheduleEscrow,
              connected,
              destinationAccountReady,
              feedback:
                connected && !destinationAccountReady
                  ? "Enter destination account."
                  : connected && !canScheduleEscrow
                    ? "Scheduled transfers are not available on this deployed escrow."
                    : automationFeedback,
              isPending,
              maxChecks,
              rateJsonPath,
              rateSourceReady,
              rateSourceVerified,
              rateUrl,
              revealed: canvasRevealed,
              settlementPair,
              targetRate,
              onRun: onRunAutomation,
              setMaxChecks,
              setTargetRate,
            } satisfies AutomationNodeData,
          };
        }

        return node;
      }),
    [
      amount,
      assetReady,
      automationFeedback,
      canUseEscrow,
      canScheduleEscrow,
      canvasRevealed,
      connected,
      destinationAccount,
      destinationAccountReady,
      feeText,
      feedback,
      isConnected,
      isPending,
      maxChecks,
      minOut,
      nodes,
      quoteCode,
      rateSourceReady,
      rateSourceVerified,
      rateJsonPath,
      rateUrl,
      settlementFeedback,
      settlementPair,
      settlementVaultText,
      targetRate,
      tokenSymbol,
    ],
  );

  return (
    <section className="dashboard-canvas-panel t-panel-slide" data-open={canvasRevealed ? "true" : "false"} aria-label="Settlement automation canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.35}
        colorMode="dark"
        defaultEdgeOptions={defaultEdgeOptions}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        <Panel position="top-left">
          <button type="button" className="cta cta--ghost" onClick={connectAutomation}>
            connect automation
          </button>
        </Panel>
      </ReactFlow>
    </section>
  );
}
