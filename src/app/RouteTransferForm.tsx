"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { escrowAbi, escrowAddress, escrowConfigured } from "@/lib/escrow";
import { createAutomationRun, saveAutomationRun } from "@/lib/automationRuns";
import { createPayoutReference } from "@/lib/references";
import {
  getDefaultTokenSymbol,
  getTokenAddress,
  getTokenBySymbol,
  tokenConfigured,
  tokenOptions,
} from "@/lib/tokens";

const DEFAULT_URL = process.env.NEXT_PUBLIC_DEFAULT_RATE_URL || "";
const DEFAULT_PATH = process.env.NEXT_PUBLIC_DEFAULT_RATE_JSONPATH || "";
const TEST_SETTLEMENT_PAIR = process.env.NEXT_PUBLIC_TEST_SETTLEMENT_PAIR || "";

const quoteOptions = [
  { code: "USD", label: "USD", pair: "USDC / USD" },
  { code: "EUR", label: "EUR", pair: "USDC / EUR" },
  { code: "SOMI", label: "SOMI", pair: "USDC / SOMI" },
] as const;

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

type SettlementNodeData = {
  amount: string;
  assetReady: boolean;
  canUseEscrow: boolean;
  customQuoteCode: string;
  decimals: string;
  feeText: string;
  feedback: string;
  isConnected: boolean;
  isPending: boolean;
  minOut: string;
  quoteCode: string;
  tokenSymbol: string;
  onApprove: () => void;
  onCustomQuoteCodeChange: (value: string) => void;
  onDecimalsChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTokenChange: (value: string) => void;
  setAmount: (value: string) => void;
  setMinOut: (value: string) => void;
  setQuoteCode: (value: string) => void;
};

type AutomationNodeData = {
  assetReady: boolean;
  connected: boolean;
  feedback: string;
  maxChecks: string;
  rateJsonPath: string;
  rateSourceReady: boolean;
  rateUrl: string;
  settlementPair: string;
  targetRate: string;
  onRun: () => void;
  setMaxChecks: (value: string) => void;
  setRateJsonPath: (value: string) => void;
  setRateUrl: (value: string) => void;
  setTargetRate: (value: string) => void;
};

type SettlementNode = Node<SettlementNodeData, "settlement">;
type AutomationNode = Node<AutomationNodeData, "automation">;

function SettlementCardNode({ data }: NodeProps<SettlementNode>) {
  return (
    <form className="flow-node-card settlement-node" onSubmit={data.onSubmit}>
      <Handle type="source" position={Position.Right} />
      <div className="flow-node-card__head">
        <span className="label">settlement</span>
        <strong>Lock funds</strong>
      </div>
      <div className="node-form-grid">
        <label className="field">
          <span className="label">asset</span>
          <select className="nodrag" value={data.tokenSymbol} onChange={(event) => data.onTokenChange(event.target.value)}>
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
            value={data.amount}
            onChange={(event) => data.setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.0"
            required
          />
        </label>
        <label className="field">
          <span className="label">minimum output</span>
          <input
            className="mono numeric nodrag"
            value={data.minOut}
            onChange={(event) => data.setMinOut(event.target.value)}
            inputMode="decimal"
            placeholder="0.0"
            required
          />
        </label>
        <label className="field">
          <span className="label">pair</span>
          <select className="nodrag" value={data.quoteCode} onChange={(event) => data.setQuoteCode(event.target.value)}>
            {quoteOptions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.pair}
              </option>
            ))}
            <option value="CUSTOM">Custom</option>
          </select>
        </label>
        {data.quoteCode === "CUSTOM" && (
          <label className="field">
            <span className="label">quote code</span>
            <input
              className="mono nodrag"
              value={data.customQuoteCode}
              onChange={(event) => data.onCustomQuoteCodeChange(event.target.value.toUpperCase())}
              placeholder="GBP"
              maxLength={8}
            />
          </label>
        )}
        <label className="field">
          <span className="label">decimals</span>
          <input
            className="mono numeric nodrag"
            value={data.decimals}
            onChange={(event) => data.onDecimalsChange(event.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>
      <div className="node-note">
        <span>Fee</span>
        <span className="mono">{data.feeText}</span>
      </div>
      <div className="node-actions">
        <span className={`label form-feedback ${data.feedback ? "form-feedback--active" : ""}`}>
          {data.feedback || "ready"}
        </span>
        <div>
          <button
            type="button"
            className="cta cta--ghost nodrag"
            disabled={!data.isConnected || data.isPending || !data.assetReady}
            onClick={data.onApprove}
          >
            approve
          </button>
          <button
            type="submit"
            className="cta nodrag"
            disabled={!data.isConnected || data.isPending || !data.canUseEscrow || !data.assetReady}
          >
            {data.isPending ? "submitting..." : "lock"}
          </button>
        </div>
      </div>
    </form>
  );
}

function AutomationCardNode({ data }: NodeProps<AutomationNode>) {
  return (
    <section className="flow-node-card automation-node">
      <Handle type="target" position={Position.Left} />
      <div className="flow-node-card__head">
        <span className="label">automation</span>
        <strong>Rate check</strong>
      </div>
      <div className="node-form-grid">
        <label className="field field--wide">
          <span className="label">reference rate URL</span>
          <input
            className="mono nodrag"
            value={data.rateUrl}
            onChange={(event) => data.setRateUrl(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="https://..."
          />
        </label>
        <label className="field">
          <span className="label">JSON path</span>
          <input
            className="mono nodrag"
            value={data.rateJsonPath}
            onChange={(event) => data.setRateJsonPath(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="$.rate"
          />
        </label>
        <label className="field">
          <span className="label">target rate</span>
          <input
            className="mono numeric nodrag"
            value={data.targetRate}
            onChange={(event) => data.setTargetRate(event.target.value)}
            inputMode="decimal"
            placeholder="1.00"
          />
        </label>
        <label className="field">
          <span className="label">max checks</span>
          <input
            className="mono numeric nodrag"
            value={data.maxChecks}
            onChange={(event) => data.setMaxChecks(event.target.value)}
            inputMode="numeric"
            placeholder="5"
          />
        </label>
        <div className="node-note">
          <span>Pair</span>
          <span className="mono">{data.settlementPair}</span>
        </div>
      </div>
      <div className="node-actions">
        <span className="label form-feedback">{data.feedback}</span>
        <button type="button" className="cta nodrag" disabled={!data.connected} onClick={data.onRun}>
          run
        </button>
      </div>
    </section>
  );
}

const nodeTypes = {
  settlement: SettlementCardNode,
  automation: AutomationCardNode,
};

export default function RouteTransferForm() {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { data: quoteCost } = useReadContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: "quoteTotalCost",
    query: { enabled: escrowConfigured },
  });

  const [tokenSymbol, setTokenSymbol] = useState(getDefaultTokenSymbol());
  const selectedToken = getTokenBySymbol(tokenSymbol);
  const token = tokenConfigured(selectedToken) ? getTokenAddress(selectedToken) : undefined;
  const [amount, setAmount] = useState("");
  const [minOut, setMinOut] = useState("");
  const [decimals, setDecimals] = useState(selectedToken?.decimals ?? "");
  const [quoteCode, setQuoteCode] = useState(TEST_SETTLEMENT_PAIR || quoteOptions[0].code);
  const [customQuoteCode, setCustomQuoteCode] = useState("");
  const [payoutReference] = useState(() => createPayoutReference());
  const [rateUrl, setRateUrl] = useState(DEFAULT_URL);
  const [rateJsonPath, setRateJsonPath] = useState(DEFAULT_PATH);
  const [targetRate, setTargetRate] = useState("");
  const [maxChecks, setMaxChecks] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [automationFeedback, setAutomationFeedback] = useState("Connect settlement to automation.");

  const totalCost = quoteCost?.[3] ?? 0n;
  const canUseEscrow = escrowConfigured && totalCost > 0n;
  const assetReady = tokenConfigured(selectedToken);
  const rateSourceReady = Boolean(rateUrl.trim() && rateJsonPath.trim());
  const resolvedQuoteCode = quoteCode === "CUSTOM" ? customQuoteCode.trim().toUpperCase() : quoteCode;
  const selectedQuote = quoteOptions.find((option) => option.code === quoteCode);
  const settlementPair = selectedQuote?.pair ?? `USDC / ${resolvedQuoteCode || "custom"}`;
  const feeText = !escrowConfigured
    ? "escrow not configured"
    : quoteCost
      ? `${formatEther(totalCost)} STT`
      : "fee quote loading";

  function parseAmountInput() {
    const d = Number(decimals);
    if (!Number.isInteger(d) || d < 0 || d > 24) {
      throw new Error("Decimals must be 0-24.");
    }
    return parseUnits(amount || "0", d);
  }

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([
    { id: "settlement", type: "settlement", position: { x: 40, y: 90 }, data: {} },
    { id: "automation", type: "automation", position: { x: 500, y: 90 }, data: {} },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const connected = edges.some((edge) => edge.source === "settlement" && edge.target === "automation");

  useEffect(() => {
    function layoutNodes() {
      const width = window.innerWidth;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (width <= 520) {
            return {
              ...node,
              position: node.id === "settlement" ? { x: 40, y: 70 } : { x: 40, y: 500 },
            };
          }

          if (width <= 900) {
            return {
              ...node,
              position: node.id === "settlement" ? { x: 40, y: 60 } : { x: 40, y: 500 },
            };
          }

          return {
            ...node,
            position: node.id === "settlement" ? { x: 40, y: 90 } : { x: 500, y: 90 },
          };
        }),
      );
    }

    layoutNodes();
    window.addEventListener("resize", layoutNodes);
    return () => window.removeEventListener("resize", layoutNodes);
  }, [setNodes]);

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
    setDecimals(selectedToken?.decimals ?? "");
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
      setFeedback(`Approval submitted: ${hash}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "approval failed");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    setDecimals(selectedToken?.decimals ?? "");
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
      minOutVal = parseUnits(minOut || "0", Number(decimals));
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
    if (!resolvedQuoteCode.trim()) {
      setFeedback("Quote code is required.");
      return;
    }
    if (!rateSourceReady) {
      setFeedback("Connect automation details first.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "requestTransfer",
        value: totalCost,
        args: [token as Address, amountIn, minOutVal, resolvedQuoteCode, payoutReference, rateUrl, rateJsonPath],
      });
      setFeedback(`Submitted: ${hash}`);
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

  function onRunAutomation() {
    if (!connected) {
      setAutomationFeedback("Connect the settlement card first.");
      return;
    }
    if (!assetReady) {
      setAutomationFeedback("USDC is not configured.");
      return;
    }
    if (!rateSourceReady) {
      setAutomationFeedback("Add rate URL and JSON path.");
      return;
    }

    const run = createAutomationRun({
      amount: amount || "0.0",
      assetSymbol: selectedToken?.symbol ?? "USDC",
      maxChecks,
      minOut: minOut || "0.0",
      settlementPair,
      status: "ready",
      targetRate: targetRate || "not set",
    });
    saveAutomationRun(run);
    setAutomationFeedback(`Saved ${run.id}`);
  }

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id === "settlement") {
          return {
            ...node,
            data: {
              amount,
              assetReady,
              canUseEscrow,
              customQuoteCode,
              decimals,
              feeText,
              feedback,
              isConnected,
              isPending,
              minOut,
              quoteCode,
              tokenSymbol,
              onApprove,
              onCustomQuoteCodeChange: setCustomQuoteCode,
              onDecimalsChange: setDecimals,
              onSubmit,
              onTokenChange: (value: string) => {
                const nextToken = getTokenBySymbol(value);
                if (!nextToken) {
                  return;
                }
                setTokenSymbol(nextToken.symbol);
                setDecimals(nextToken.decimals);
              },
              setAmount,
              setMinOut,
              setQuoteCode,
            } satisfies SettlementNodeData,
          };
        }

        if (node.id === "automation") {
          return {
            ...node,
            data: {
              assetReady,
              connected,
              feedback: automationFeedback,
              maxChecks,
              rateJsonPath,
              rateSourceReady,
              rateUrl,
              settlementPair,
              targetRate,
              onRun: onRunAutomation,
              setMaxChecks,
              setRateJsonPath,
              setRateUrl,
              setTargetRate,
            } satisfies AutomationNodeData,
          };
        }

        return node;
      }),
    );
  }, [
    amount,
    assetReady,
    automationFeedback,
    canUseEscrow,
    connected,
    customQuoteCode,
    decimals,
    feeText,
    feedback,
    isConnected,
    isPending,
    maxChecks,
    minOut,
    quoteCode,
    rateJsonPath,
    rateSourceReady,
    rateUrl,
    setNodes,
    settlementPair,
    targetRate,
    tokenSymbol,
  ]);

  return (
    <section className="dashboard-canvas-panel" aria-label="Settlement automation canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.35}
        colorMode="dark"
        defaultEdgeOptions={{ animated: true, type: "smoothstep" }}
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
