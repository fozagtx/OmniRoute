"use client";

import { useEffect, useState } from "react";
import { formatUnits, isAddress, parseAbiItem, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { escrowAddress } from "@/lib/escrow";

const scheduledTransferCreatedEvent = parseAbiItem(
  "event ScheduledTransferCreated(uint256 indexed jobId,address indexed depositor,address indexed token,uint256 amountIn,uint256 minOut,uint256 targetRate,uint256 maxChecks,string destinationCurrency,string destinationAccount,string rateUrl)",
);

type ScheduledTransferRow = {
  jobId: bigint;
  depositor: Address;
  token: Address;
  amountIn: bigint;
  minOut: bigint;
  targetRate: bigint;
  maxChecks: bigint;
  destinationCurrency: string;
  destinationAccount: string;
  rateUrl: string;
  blockNumber: bigint;
  transactionHash: string;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AutomationsPage() {
  const publicClient = usePublicClient();
  const [rows, setRows] = useState<ScheduledTransferRow[]>([]);
  const [status, setStatus] = useState("Loading on-chain automation jobs.");
  const [panelRevealed, setPanelRevealed] = useState(false);

  useEffect(() => {
    setPanelRevealed(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      if (!publicClient) {
        setStatus("RPC client is not ready.");
        return;
      }

      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 999n ? latestBlock - 999n : 0n;
        const logs = await publicClient.getLogs({
          address: escrowAddress,
          event: scheduledTransferCreatedEvent,
          fromBlock,
          toBlock: latestBlock,
        });

        if (cancelled) {
          return;
        }

        const decodedRows: ScheduledTransferRow[] = [];
        for (const log of logs) {
          const {
            jobId,
            depositor,
            token,
            amountIn,
            minOut,
            targetRate,
            maxChecks,
            destinationCurrency,
            destinationAccount,
            rateUrl,
          } = log.args;
          if (
            typeof jobId !== "bigint" ||
            typeof amountIn !== "bigint" ||
            typeof minOut !== "bigint" ||
            typeof targetRate !== "bigint" ||
            typeof maxChecks !== "bigint" ||
            typeof destinationCurrency !== "string" ||
            typeof destinationAccount !== "string" ||
            typeof rateUrl !== "string" ||
            typeof log.blockNumber !== "bigint" ||
            !depositor ||
            !token ||
            !isAddress(depositor) ||
            !isAddress(token)
          ) {
            continue;
          }

          decodedRows.push({
            jobId,
            depositor,
            token,
            amountIn,
            minOut,
            targetRate,
            maxChecks,
            destinationCurrency,
            destinationAccount,
            rateUrl,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        }

        setRows(decodedRows.reverse());
        setStatus(
          logs.length === 0
            ? "No on-chain automation jobs found in the latest 1,000 blocks."
            : decodedRows.length === 0
              ? "Recent automation logs could not be decoded from this escrow ABI."
              : "",
        );
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : "Could not load on-chain automation jobs.");
        }
      }
    }

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  return (
    <section className="panel automations-panel t-panel-slide" data-open={panelRevealed ? "true" : "false"} aria-labelledby="automations-head">
      <header className="panel__head">
        <h1 id="automations-head" className="display">
          Automations
        </h1>
      </header>
      <div className="panel__body">
        {status ? <div className="empty automation-empty">{status}</div> : null}
        {rows.length > 0 ? (
          <div className="automation-list">
            {rows.map((row) => (
              <article className="automation-list__item" key={`${row.transactionHash}-${row.jobId.toString()}`}>
                <div>
                  <strong>
                    Job {row.jobId.toString()} / {row.destinationCurrency}
                  </strong>
                  <span className="mono">
                    amount {row.amountIn.toString()} base units / min {row.minOut.toString()} base units
                  </span>
                  <span className="mono">
                    target {formatUnits(row.targetRate, 8)} / checks {row.maxChecks.toString()}
                  </span>
                  <span className="mono">
                    depositor {shortAddress(row.depositor)} / token {shortAddress(row.token)}
                  </span>
                  <span className="mono">block {row.blockNumber.toString()}</span>
                </div>
                <span className="status-pill">{shortAddress(row.transactionHash)}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
