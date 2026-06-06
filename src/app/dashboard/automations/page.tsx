"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { decodeEventLog, getAddress, isAddress, type Hex } from "viem";
import {
  actionKindLabels,
  marketStatusLabels,
  predictionMarketAbi,
  predictionMarketAddress,
  predictionMarketConfigured,
  responseStatusLabels,
  sideLabels,
} from "@/lib/predictionMarket";

type MarketLogRow = {
  blockNumber: string;
  data: Hex;
  detail: string;
  eventName: string;
  logIndex: string;
  topics: readonly Hex[];
  transactionHash: Hex;
};

function normalizeMarketAddress(value: string) {
  const candidate = value.trim();
  return isAddress(candidate) ? getAddress(candidate) : undefined;
}

function shortHex(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 3) {
    return value;
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function readJsonPath(payload: unknown, selector: string) {
  const normalized = selector.trim().replace(/^\$\./, "");
  if (!normalized) return payload;

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

function formatJsonValue(value: unknown) {
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return JSON.stringify(value);
}

function labelFrom<T extends readonly string[]>(labels: T, value: number | bigint | undefined) {
  if (value === undefined) return "not read";
  const index = typeof value === "bigint" ? Number(value) : value;
  return labels[index] ?? `#${index}`;
}

function describeLog(log: { data: Hex; topics: readonly Hex[] }) {
  if (!log.topics[0]) {
    return { eventName: "RawLog", detail: "log has no event signature topic" };
  }

  try {
    const topics = log.topics as [Hex, ...Hex[]];
    const decoded = decodeEventLog({
      abi: predictionMarketAbi,
      data: log.data,
      topics,
    });
    const eventName: string = decoded.eventName;

    if (decoded.eventName === "MarketCreated") {
      return {
        eventName: decoded.eventName,
        detail: `market ${decoded.args.marketId.toString()} / ${decoded.args.question}`,
      };
    }

    if (decoded.eventName === "PolicyCreated") {
      return {
        eventName: decoded.eventName,
        detail: `policy ${decoded.args.policyId.toString()} / ${labelFrom(sideLabels, decoded.args.allowedSide)} / executor ${shortHex(decoded.args.executor)}`,
      };
    }

    if (decoded.eventName === "MarketActionRecorded") {
      return {
        eventName: decoded.eventName,
        detail: `action ${decoded.args.actionId.toString()} / market ${decoded.args.marketId.toString()} / ${labelFrom(actionKindLabels, decoded.args.kind)}`,
      };
    }

    if (decoded.eventName === "ResolutionRequested") {
      return {
        eventName: decoded.eventName,
        detail: `market ${decoded.args.marketId.toString()} / request ${decoded.args.requestId.toString()}`,
      };
    }

    if (decoded.eventName === "ResolutionReceived") {
      return {
        eventName: decoded.eventName,
        detail: `market ${decoded.args.marketId.toString()} / ${labelFrom(responseStatusLabels, decoded.args.status)} / ${decoded.args.output}`,
      };
    }

    if (decoded.eventName === "MarketResolved") {
      return {
        eventName: decoded.eventName,
        detail: `market ${decoded.args.marketId.toString()} / ${labelFrom(sideLabels, decoded.args.outcome)} / ${decoded.args.output}`,
      };
    }

    if (decoded.eventName === "ResolutionFailed") {
      return {
        eventName: decoded.eventName,
        detail: `market ${decoded.args.marketId.toString()} / ${labelFrom(responseStatusLabels, decoded.args.status)} / ${decoded.args.output}`,
      };
    }

    if (decoded.eventName === "Claimed") {
      return {
        eventName: decoded.eventName,
        detail: `market ${decoded.args.marketId.toString()} / trader ${shortHex(decoded.args.trader)} / payout ${decoded.args.payout.toString()}`,
      };
    }

    if (decoded.eventName === "PolicyDisabled") {
      return {
        eventName: decoded.eventName,
        detail: `policy ${decoded.args.policyId.toString()}`,
      };
    }

    if (decoded.eventName === "NativeCreditDeposited" || decoded.eventName === "NativeCreditWithdrawn" || decoded.eventName === "AgentRebateCredited") {
      return {
        eventName: decoded.eventName,
        detail: `${shortHex(decoded.args.account)} / ${decoded.args.amount.toString()} wei`,
      };
    }

    return { eventName, detail: "decoded market event" };
  } catch {
    return { eventName: "RawLog", detail: "undecoded market log" };
  }
}

export default function ReceiptsPage() {
  const publicClient = usePublicClient();
  const [marketAddressInput, setMarketAddressInput] = useState(predictionMarketAddress ?? "");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [jsonPath, setJsonPath] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("Enter a Somnia receipt endpoint.");
  const [receiptResult, setReceiptResult] = useState("");
  const [rows, setRows] = useState<MarketLogRow[]>([]);
  const [status, setStatus] = useState(
    predictionMarketConfigured
      ? "Load market logs from Somnia RPC."
      : "NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS is not configured with a valid market address.",
  );
  const [panelRevealed, setPanelRevealed] = useState(false);
  const marketAddress = useMemo(() => normalizeMarketAddress(marketAddressInput), [marketAddressInput]);

  useEffect(() => {
    setPanelRevealed(true);
  }, []);

  async function loadReceipt() {
    const url = endpointUrl.trim();
    if (!url) {
      setReceiptStatus("Enter a Somnia receipt endpoint.");
      return;
    }

    try {
      setReceiptStatus("Fetching resolver receipt.");
      setReceiptResult("");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Receipt endpoint returned ${response.status}.`);
      }
      const payload = await response.json();
      const selected = jsonPath.trim() ? readJsonPath(payload, jsonPath) : payload;
      setReceiptResult(formatJsonValue(selected));
      setReceiptStatus("Resolver receipt loaded from endpoint.");
    } catch (err) {
      setReceiptStatus(err instanceof Error ? err.message : "Resolver receipt fetch failed.");
    }
  }

  async function loadRows() {
    if (!publicClient) {
      setStatus("RPC client is not ready.");
      return;
    }
    if (!marketAddress) {
      setStatus("Enter a valid market address.");
      return;
    }

    try {
      setStatus("Loading market logs from Somnia RPC.");
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 999n ? latestBlock - 999n : 0n;
      const logs = await publicClient.getLogs({
        address: marketAddress,
        fromBlock,
        toBlock: latestBlock,
      });
      const decodedRows: MarketLogRow[] = logs.map((log) => {
        const decoded = describeLog(log);
        return {
          blockNumber: log.blockNumber?.toString() ?? "pending",
          data: log.data,
          detail: decoded.detail,
          eventName: decoded.eventName,
          logIndex: typeof log.logIndex === "number" ? log.logIndex.toString() : String(log.logIndex ?? ""),
          topics: log.topics,
          transactionHash: log.transactionHash,
        };
      });

      setRows(decodedRows.reverse());
      setStatus(
        decodedRows.length === 0
          ? "No market logs returned for this address in the latest 1,000 blocks."
          : `Loaded ${decodedRows.length} market logs from the latest 1,000 blocks.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not load market logs.");
    }
  }

  return (
    <section
      className="panel automations-panel t-panel-slide"
      data-open={panelRevealed ? "true" : "false"}
      aria-labelledby="receipts-head"
    >
      <header className="panel__head">
        <h1 id="receipts-head" className="display">
          Receipts
        </h1>
      </header>
      <div className="panel__body">
        <div className="form-grid">
          <label className="field field--wide">
            <span className="label">market address</span>
            <input
              className="mono"
              value={marketAddressInput}
              onChange={(event) => setMarketAddressInput(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="field field--wide">
            <span className="label">receipt endpoint</span>
            <input
              className="mono"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span className="label">result path</span>
            <input
              className="mono"
              value={jsonPath}
              onChange={(event) => setJsonPath(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="form-actions">
            <div className="form-actions__buttons">
              <button type="button" className="cta cta--ghost" disabled={!endpointUrl.trim()} onClick={loadReceipt}>
                load receipt
              </button>
              <button type="button" className="cta" disabled={!marketAddress} onClick={loadRows}>
                load logs
              </button>
            </div>
          </div>
        </div>

        <div className="receipt-note receipt-note--muted">
          <span>{receiptStatus}</span>
          <span className="mono">{receiptResult || "no endpoint result loaded"}</span>
        </div>

        {status ? <div className="empty automation-empty">{status}</div> : null}
        {rows.length > 0 ? (
          <div className="automation-list">
            {rows.map((row) => (
              <article className="automation-list__item" key={`${row.transactionHash}-${row.logIndex}`}>
                <div>
                  <strong>{row.eventName}</strong>
                  <span className="mono">{row.detail}</span>
                  <span className="mono">tx {shortHex(row.transactionHash)}</span>
                  <span className="mono">block {row.blockNumber}</span>
                  <span className="mono">topics {row.topics.length}</span>
                  <span className="mono">data {shortHex(row.data, 10, 8)}</span>
                </div>
                <span className="status-pill">{shortHex(row.transactionHash)}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
