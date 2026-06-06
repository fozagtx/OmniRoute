"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, Lock, Plus, Search, Send, WalletCards } from "lucide-react";
import { formatEther, parseEther, type Address } from "viem";
import {
  bountyStatusLabels,
  clipBountyAbi,
  clipBountyAddress,
  clipBountyConfigured,
  submissionStatusLabels,
} from "@/lib/clipBounty";
import { useWallet } from "@/lib/wallet";

type BountyTuple = readonly [
  Address,
  string,
  string,
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  number,
  bigint,
];

type SubmissionTuple = readonly [bigint, Address, string, bigint, number, bigint, bigint, bigint, string, bigint];

type BountyRow = {
  id: number;
  creator: Address;
  title: string;
  campaignUrl: string;
  rules: string;
  minViews: bigint;
  rewardPerClip: bigint;
  maxPayouts: bigint;
  totalFunded: bigint;
  totalPaid: bigint;
  submissionCount: bigint;
  approvedCount: bigint;
  deadline: bigint;
  status: number;
};

type SubmissionRow = {
  id: number;
  bountyId: bigint;
  clipper: Address;
  clipUrl: string;
  status: number;
  requestId: bigint;
  receipt: bigint;
  observedViews: bigint;
  paidAmount: bigint;
};

type ActiveBountyTask = "submit" | "verify" | "create" | "funds";

type WriteContractInput = {
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

function parsePositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
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

function formatCount(value: bigint | undefined) {
  if (typeof value !== "bigint") return "not read";
  return new Intl.NumberFormat("en-US").format(Number(value));
}

function formatDate(value: bigint | undefined) {
  if (typeof value !== "bigint" || value === 0n) return "not read";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(Number(value) * 1000),
  );
}

function labelFrom<T extends readonly string[]>(labels: T, value: number | bigint | undefined) {
  if (value === undefined) return "not read";
  const index = typeof value === "bigint" ? Number(value) : value;
  return labels[index] ?? `#${index}`;
}

function bountyFromTuple(id: number, data: BountyTuple): BountyRow {
  return {
    id,
    creator: data[0],
    title: data[1],
    campaignUrl: data[2],
    rules: data[3],
    minViews: data[4],
    rewardPerClip: data[5],
    maxPayouts: data[6],
    totalFunded: data[7],
    totalPaid: data[8],
    submissionCount: data[9],
    approvedCount: data[10],
    deadline: data[11],
    status: data[12],
  };
}

function submissionFromTuple(id: number, data: SubmissionTuple): SubmissionRow {
  return {
    id,
    bountyId: data[0],
    clipper: data[1],
    clipUrl: data[2],
    status: data[4],
    requestId: data[5],
    receipt: data[6],
    observedViews: data[7],
    paidAmount: data[9],
  };
}

function availableFor(row: BountyRow | undefined) {
  return row ? row.totalFunded - row.totalPaid : undefined;
}

export default function ClipBountyApp() {
  const { address, isConnected, publicClient, walletClient } = useWallet();
  const [isPending, setIsPending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [activeTask, setActiveTask] = useState<ActiveBountyTask>("submit");

  const [title, setTitle] = useState("First YouTube clip push");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [rules, setRules] = useState(
    "Submit a public YouTube Short that references the campaign and reaches the view target before the deadline.",
  );
  const [minViews, setMinViews] = useState("1000");
  const [rewardPerClip, setRewardPerClip] = useState("0.2");
  const [maxPayouts, setMaxPayouts] = useState("3");
  const [deadlineDays, setDeadlineDays] = useState("14");

  const [bountyId, setBountyId] = useState("");
  const [clipUrl, setClipUrl] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [feedback, setFeedback] = useState("");
  const [bountyCount, setBountyCount] = useState<bigint>();
  const [submissionCount, setSubmissionCount] = useState<bigint>();
  const [verificationCost, setVerificationCost] = useState<bigint>();
  const [nativeCredit, setNativeCredit] = useState<bigint>();
  const [bountyRows, setBountyRows] = useState<BountyRow[]>([]);
  const [submissionRows, setSubmissionRows] = useState<SubmissionRow[]>([]);
  const [selectedBounty, setSelectedBounty] = useState<BountyRow>();
  const [bountiesError, setBountiesError] = useState("");
  const [bountiesLoading, setBountiesLoading] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const contractEnabled = clipBountyConfigured && Boolean(clipBountyAddress);
  const writeDisabled = isPending || !contractEnabled || !isConnected;
  const writeTitle = !isConnected ? "Connect wallet before sending a transaction." : undefined;

  const bountyIdForRead = useMemo(() => {
    const parsed = Number.parseInt(bountyId, 10);
    return Number.isInteger(parsed) && parsed > 0 ? BigInt(parsed) : undefined;
  }, [bountyId]);

  const selectedRow = selectedBounty ?? bountyRows.find((row) => row.id.toString() === bountyId);
  const taskTabId = `bounty-task-${activeTask}`;

  const loadContractSnapshot = useCallback(async () => {
    if (!clipBountyAddress) return undefined;

    const [quote, bountyTotal, submissionTotal] = await Promise.all([
      publicClient.readContract({
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName: "quoteVerificationCost",
      }),
      publicClient.readContract({
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName: "bountyCount",
      }),
      publicClient.readContract({
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName: "submissionCount",
      }),
    ]);

    setVerificationCost((quote as readonly [bigint, bigint, bigint])[2]);
    setBountyCount(bountyTotal as bigint);
    setSubmissionCount(submissionTotal as bigint);

    if (address) {
      const credit = (await publicClient.readContract({
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName: "nativeCredits",
        args: [address],
      })) as bigint;
      setNativeCredit(credit);
    } else {
      setNativeCredit(undefined);
    }

    return bountyTotal as bigint;
  }, [address, publicClient]);

  const loadBounties = useCallback(
    async (countValue = bountyCount) => {
      if (!clipBountyAddress || typeof countValue !== "bigint" || countValue === 0n) {
        setBountyRows([]);
        setBountiesLoading(false);
        return;
      }

      setBountiesError("");
      setBountiesLoading(true);
      try {
        const contractAddress = clipBountyAddress;
        const count = Number(countValue);
        const first = Math.max(1, count - 11);
        const ids = Array.from({ length: count - first + 1 }, (_, index) => count - index);
        const rows = await Promise.all(
          ids.map(async (id) => {
            const data = (await publicClient.readContract({
              address: contractAddress,
              abi: clipBountyAbi,
              functionName: "bounties",
              args: [BigInt(id)],
            })) as BountyTuple;
            return bountyFromTuple(id, data);
          }),
        );
        setBountyRows(rows);
      } catch {
        setBountiesError("Could not load bounties from the deployed contract.");
      } finally {
        setBountiesLoading(false);
      }
    },
    [bountyCount, publicClient],
  );

  const loadSelectedBounty = useCallback(async () => {
    if (!clipBountyAddress || !bountyIdForRead) {
      setSelectedBounty(undefined);
      setSubmissionRows([]);
      return;
    }

    setSubmissionsLoading(true);
    try {
      const contractAddress = clipBountyAddress;
      const [bountyData, idsData] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: clipBountyAbi,
          functionName: "bounties",
          args: [bountyIdForRead],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: clipBountyAbi,
          functionName: "getBountySubmissionIds",
          args: [bountyIdForRead],
        }),
      ]);

      setSelectedBounty(bountyFromTuple(Number(bountyIdForRead), bountyData as BountyTuple));

      const ids = (idsData as bigint[]).slice(-8).reverse();
      const rows = await Promise.all(
        ids.map(async (id) => {
          const data = (await publicClient.readContract({
            address: contractAddress,
            abi: clipBountyAbi,
            functionName: "submissions",
            args: [id],
          })) as SubmissionTuple;
          return submissionFromTuple(Number(id), data);
        }),
      );
      setSubmissionRows(rows);
    } catch {
      setSelectedBounty(undefined);
      setSubmissionRows([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [bountyIdForRead, publicClient]);

  useEffect(() => {
    setRevealed(true);
  }, []);

  useEffect(() => {
    void loadContractSnapshot().then((count) => loadBounties(count));
  }, [loadContractSnapshot, loadBounties]);

  useEffect(() => {
    void loadSelectedBounty();
  }, [loadSelectedBounty]);

  useEffect(() => {
    if (!bountyId && bountyRows[0]) {
      setBountyId(bountyRows[0].id.toString());
    }
  }, [bountyId, bountyRows]);

  useEffect(() => {
    function syncHashTask() {
      const nextTask = window.location.hash.replace("#bounty-task-", "");
      if (nextTask === "submit" || nextTask === "verify" || nextTask === "create" || nextTask === "funds") {
        setActiveTask(nextTask);
      }
    }

    syncHashTask();
    window.addEventListener("hashchange", syncHashTask);
    return () => window.removeEventListener("hashchange", syncHashTask);
  }, []);

  function activateTask(task: ActiveBountyTask) {
    setActiveTask(task);
    const nextHash = `#bounty-task-${task}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  function selectBounty(id: number) {
    setBountyId(id.toString());
    activateTask("submit");
  }

  async function writeClipContract({ args, functionName, value }: WriteContractInput) {
    if (!clipBountyAddress || !walletClient || !address) {
      throw new Error("Connect a wallet first.");
    }

    setIsPending(true);
    try {
      const hash = await walletClient.writeContract({
        account: address,
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName,
        args,
        value,
      } as unknown as Parameters<typeof walletClient.writeContract>[0]);
      return await publicClient.waitForTransactionReceipt({ hash });
    } finally {
      setIsPending(false);
    }
  }

  async function refreshAfterWrite() {
    const count = await loadContractSnapshot();
    await loadBounties(count);
    await loadSelectedBounty();
  }

  async function onCreateBounty(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      if (!title.trim() || !campaignUrl.trim() || !rules.trim()) {
        throw new Error("Title, campaign URL, and rules are required.");
      }
      const requiredViews = BigInt(parsePositiveInteger(minViews, "Minimum views"));
      const reward = parseNativeAmount(rewardPerClip, "Reward per clip");
      const maxClips = parsePositiveInteger(maxPayouts, "Max payouts");
      const days = parsePositiveInteger(deadlineDays, "Deadline days");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + days * 86_400);
      const funding = reward * BigInt(maxClips);

      const receipt = await writeClipContract({
        functionName: "createBounty",
        args: [title.trim(), campaignUrl.trim(), rules.trim(), requiredViews, reward, BigInt(maxClips), deadline],
        value: funding,
      });

      const nextCount = (await publicClient.readContract({
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName: "bountyCount",
      })) as bigint;
      setBountyId(nextCount.toString());
      activateTask("submit");
      setFeedback(`Bounty created in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Bounty creation failed.");
    }
  }

  async function onSubmitClip(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedBountyId = parsePositiveInteger(bountyId, "Bounty ID");
      if (!clipUrl.trim()) throw new Error("YouTube clip URL is required.");
      const receipt = await writeClipContract({
        functionName: "submitClip",
        args: [BigInt(parsedBountyId), clipUrl.trim()],
      });
      const nextSubmissionCount = (await publicClient.readContract({
        address: clipBountyAddress,
        abi: clipBountyAbi,
        functionName: "submissionCount",
      })) as bigint;
      setSubmissionId(nextSubmissionCount.toString());
      activateTask("verify");
      setFeedback(`Clip submitted in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Clip submission failed.");
    }
  }

  async function onRequestVerification() {
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }
    if (typeof verificationCost !== "bigint") {
      setFeedback("Verification fee is not available from the contract.");
      return;
    }

    try {
      const parsedSubmissionId = parsePositiveInteger(submissionId, "Submission ID");
      const receipt = await writeClipContract({
        functionName: "requestVerification",
        value: verificationCost,
        args: [BigInt(parsedSubmissionId)],
      });
      setFeedback(`Verification requested in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Verification request failed.");
    }
  }

  async function onFundBounty() {
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedBountyId = parsePositiveInteger(bountyId, "Bounty ID");
      const value = parseNativeAmount(fundAmount, "Funding amount");
      const receipt = await writeClipContract({
        functionName: "fundBounty",
        value,
        args: [BigInt(parsedBountyId)],
      });
      setFeedback(`Bounty funded in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Funding failed.");
    }
  }

  async function onCloseBounty() {
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const parsedBountyId = parsePositiveInteger(bountyId, "Bounty ID");
      const receipt = await writeClipContract({
        functionName: "closeBounty",
        args: [BigInt(parsedBountyId)],
      });
      setFeedback(`Bounty closed in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Close failed.");
    }
  }

  async function onWithdrawCredit() {
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }

    try {
      const amount = parseNativeAmount(withdrawAmount, "Withdraw amount");
      const receipt = await writeClipContract({
        functionName: "withdrawCredit",
        args: [amount],
      });
      setFeedback(`Credit withdrawn in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Credit withdrawal failed.");
    }
  }

  return (
    <section className="clip-app t-panel-slide" data-open={revealed ? "true" : "false"} aria-label="YouTube clip bounty escrow">
      <header className="clip-app__head">
        <div>
          <h1 className="display">Clip bounties</h1>
          <p>Fund YouTube clip rewards, submit public URLs, and let Somnia verify views before escrow pays.</p>
        </div>
        <div className="clip-contract-chip">
          <span>Contract</span>
          <strong>{clipBountyAddress ? `${clipBountyAddress.slice(0, 6)}...${clipBountyAddress.slice(-4)}` : "Not configured"}</strong>
        </div>
      </header>

      <div className="clip-workbench">
        <section className="panel clip-list-panel" id="bounties" aria-label="Bounties">
          <div className="panel__head">
            <div>
              <p className="label">Bounties</p>
              <strong>Live escrow state</strong>
            </div>
            <button type="button" className="cta cta--ghost" disabled={!contractEnabled || isPending} onClick={() => void refreshAfterWrite()}>
              Refresh
            </button>
          </div>
          <div className="panel__body">
            {bountiesError ? <p className="panel-state panel-state--error">{bountiesError}</p> : null}
            {!bountiesError && bountiesLoading ? <p className="panel-state">Loading bounties.</p> : null}
            {!bountiesError && !bountiesLoading && bountyRows.length === 0 ? (
              <p className="panel-state">No bounties found on the deployed contract.</p>
            ) : null}
            {!bountiesError && !bountiesLoading && bountyRows.length > 0 ? (
              <div className="clip-list">
                {bountyRows.map((bounty) => {
                  const selected = bounty.id.toString() === bountyId;
                  return (
                    <article className="clip-row-card" data-selected={selected ? "true" : "false"} key={bounty.id}>
                      <div className="clip-row-card__top">
                        <span>Bounty {bounty.id}</span>
                        <span>{labelFrom(bountyStatusLabels, bounty.status)}</span>
                      </div>
                      <h2>{bounty.title}</h2>
                      <div className="clip-row-card__meta">
                        <span>{formatCount(bounty.minViews)} views</span>
                        <span>{formatNative(bounty.rewardPerClip)} / clip</span>
                        <span>
                          {formatCount(bounty.approvedCount)} / {formatCount(bounty.maxPayouts)} paid
                        </span>
                        <span>{formatNative(availableFor(bounty))} left</span>
                      </div>
                      <div className="clip-row-card__side">
                        <a href={bounty.campaignUrl} target="_blank" rel="noopener noreferrer">
                          Campaign <ExternalLink aria-hidden size={12} />
                        </a>
                        <button
                          type="button"
                          className="cta cta--ghost"
                          aria-pressed={selected}
                          onClick={() => selectBounty(bounty.id)}
                        >
                          {selected ? "Selected" : "Use bounty"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel clip-action-panel" aria-label="Bounty actions">
          <div className="panel__head">
            <div>
              <p className="label">Selected bounty</p>
              <strong>{bountyId ? `Bounty ${bountyId}` : "Pick a bounty"}</strong>
            </div>
            <div className="clip-counts">
              <span>{formatCount(bountyCount)} bounties</span>
              <span>{formatCount(submissionCount)} submissions</span>
            </div>
          </div>

          <div className="panel__body">
            <div className="clip-selected">
              {selectedRow ? (
                <>
                  <div className="clip-selected__top">
                    <span>{labelFrom(bountyStatusLabels, selectedRow.status)}</span>
                    <span>Deadline {formatDate(selectedRow.deadline)}</span>
                  </div>
                  <h2>{selectedRow.title}</h2>
                  <p>{selectedRow.rules}</p>
                  <div className="clip-selected__meta">
                    <span>Target {formatCount(selectedRow.minViews)} views</span>
                    <span>Reward {formatNative(selectedRow.rewardPerClip)}</span>
                    <span>Escrow {formatNative(availableFor(selectedRow))}</span>
                    <span>
                      Paid {formatCount(selectedRow.approvedCount)} / {formatCount(selectedRow.maxPayouts)}
                    </span>
                  </div>
                  <a href={selectedRow.campaignUrl} target="_blank" rel="noopener noreferrer">
                    Open campaign <ExternalLink aria-hidden size={12} />
                  </a>
                </>
              ) : (
                <p className="panel-state">Select a bounty or create the first one.</p>
              )}
            </div>

            <div className="clip-task-tabs" role="tablist" aria-label="Bounty workflow">
              {[
                ["submit", "Submit"],
                ["verify", "Verify"],
                ["create", "Create"],
                ["funds", "Funds"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  className="clip-task-tab"
                  data-active={activeTask === key ? "true" : "false"}
                  role="tab"
                  aria-selected={activeTask === key}
                  aria-controls={`bounty-task-${key}`}
                  key={key}
                  onClick={() => activateTask(key as ActiveBountyTask)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTask === "submit" ? (
              <form className="clip-task-panel" id={taskTabId} role="tabpanel" onSubmit={onSubmitClip}>
                <div className="task-block">
                  <div className="task-block__head">
                    <Send aria-hidden size={18} />
                    <strong>Submit YouTube clip</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span className="label">Bounty ID</span>
                      <input inputMode="numeric" value={bountyId} onChange={(event) => setBountyId(event.target.value)} />
                    </label>
                    <label className="field field--wide">
                      <span className="label">YouTube clip URL</span>
                      <input
                        value={clipUrl}
                        onChange={(event) => setClipUrl(event.target.value)}
                        placeholder="https://www.youtube.com/shorts/..."
                      />
                    </label>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button type="submit" className="cta" disabled={writeDisabled} title={writeTitle}>
                      Submit clip
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {activeTask === "verify" ? (
              <div className="clip-task-panel" id={taskTabId} role="tabpanel">
                <div className="task-block">
                  <div className="task-block__head">
                    <Search aria-hidden size={18} />
                    <strong>Request Somnia check</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span className="label">Submission ID</span>
                      <input inputMode="numeric" value={submissionId} onChange={(event) => setSubmissionId(event.target.value)} />
                    </label>
                    <div className="asset-readout">
                      <span>Agent fee</span>
                      <strong>{formatNative(verificationCost)}</strong>
                    </div>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button
                      type="button"
                      className="cta"
                      disabled={writeDisabled || typeof verificationCost !== "bigint"}
                      title={writeTitle}
                      onClick={onRequestVerification}
                    >
                      Check views
                    </button>
                  </div>
                </div>

                <div className="clip-submissions" aria-label="Recent submissions">
                  <div className="clip-submissions__head">
                    <strong>Recent submissions</strong>
                    {submissionsLoading ? <span>Loading</span> : null}
                  </div>
                  {submissionRows.length === 0 ? <p className="panel-state">No clips submitted for this bounty.</p> : null}
                  {submissionRows.map((submission) => (
                    <article className="clip-submission-row" key={submission.id}>
                      <div>
                        <span>Submission {submission.id}</span>
                        <strong>{labelFrom(submissionStatusLabels, submission.status)}</strong>
                      </div>
                      <div>
                        <span>{formatCount(submission.observedViews)} views</span>
                        <span>{formatNative(submission.paidAmount)}</span>
                      </div>
                      <a href={submission.clipUrl} target="_blank" rel="noopener noreferrer">
                        YouTube <ExternalLink aria-hidden size={12} />
                      </a>
                      <button type="button" className="cta cta--ghost" onClick={() => setSubmissionId(submission.id.toString())}>
                        Use
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTask === "create" ? (
              <form className="clip-task-panel" id={taskTabId} role="tabpanel" onSubmit={onCreateBounty}>
                <div className="task-block">
                  <div className="task-block__head">
                    <Plus aria-hidden size={18} />
                    <strong>Create funded bounty</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field field--wide">
                      <span className="label">Title</span>
                      <input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </label>
                    <label className="field field--wide">
                      <span className="label">Campaign URL</span>
                      <input value={campaignUrl} onChange={(event) => setCampaignUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                    </label>
                    <label className="field field--wide">
                      <span className="label">Rules</span>
                      <textarea value={rules} onChange={(event) => setRules(event.target.value)} rows={4} />
                    </label>
                    <label className="field">
                      <span className="label">Minimum views</span>
                      <input inputMode="numeric" value={minViews} onChange={(event) => setMinViews(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Reward STT</span>
                      <input inputMode="decimal" value={rewardPerClip} onChange={(event) => setRewardPerClip(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Max payouts</span>
                      <input inputMode="numeric" value={maxPayouts} onChange={(event) => setMaxPayouts(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Deadline days</span>
                      <input inputMode="numeric" value={deadlineDays} onChange={(event) => setDeadlineDays(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <span className="form-feedback">Funds sent: reward x max payouts.</span>
                    <button type="submit" className="cta" disabled={writeDisabled} title={writeTitle}>
                      Create bounty
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {activeTask === "funds" ? (
              <div className="clip-task-panel" id={taskTabId} role="tabpanel">
                <div className="task-block">
                  <div className="task-block__head">
                    <WalletCards aria-hidden size={18} />
                    <strong>Fund or close</strong>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span className="label">Bounty ID</span>
                      <input inputMode="numeric" value={bountyId} onChange={(event) => setBountyId(event.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Add STT</span>
                      <input inputMode="decimal" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button type="button" className="cta cta--ghost" disabled={writeDisabled} title={writeTitle} onClick={onCloseBounty}>
                      Close bounty
                    </button>
                    <button type="button" className="cta" disabled={writeDisabled} title={writeTitle} onClick={onFundBounty}>
                      Add funds
                    </button>
                  </div>
                </div>

                <div className="task-block">
                  <div className="task-block__head">
                    <BadgeCheck aria-hidden size={18} />
                    <strong>Agent credit</strong>
                  </div>
                  <div className="form-grid">
                    <div className="asset-readout">
                      <span>Available</span>
                      <strong>{formatNative(nativeCredit)}</strong>
                    </div>
                    <label className="field">
                      <span className="label">Withdraw STT</span>
                      <input inputMode="decimal" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions form-actions--end">
                    <button type="button" className="cta cta--ghost" disabled={writeDisabled} title={writeTitle} onClick={onWithdrawCredit}>
                      Withdraw credit
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {feedback ? (
        <div className="clip-app__feedback" role="status">
          <Lock aria-hidden size={14} />
          <span>{feedback}</span>
        </div>
      ) : null}
    </section>
  );
}
