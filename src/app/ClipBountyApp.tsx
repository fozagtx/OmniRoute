"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

type SubmissionTuple = readonly [bigint, Address, string, bigint, number, bigint, bigint, bigint, string, bigint, bigint, bigint];

type BountyRow = {
  id: number;
  brand: Address;
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
  lastCheckedAt: bigint;
  nextCheckAt: bigint;
};

type ActiveBountyTask = "submit" | "verify" | "create" | "funds";
type AccountRole = 0 | 1 | 2;
type RegistrationRole = "brand" | "clipper";
type ClipBountyAppProps = {
  initialTask?: ActiveBountyTask;
};

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
  if (typeof value !== "bigint") return "Loading";
  const [whole, decimals = ""] = formatEther(value).split(".");
  const trimmed = decimals.slice(0, 6).replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""} STT`;
}

function formatCount(value: bigint | undefined) {
  if (typeof value !== "bigint") return "Loading";
  return new Intl.NumberFormat("en-US").format(Number(value));
}

function formatDate(value: bigint | undefined) {
  if (typeof value !== "bigint" || value === 0n) return "Pending";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(Number(value) * 1000),
  );
}

function labelFrom<T extends readonly string[]>(labels: T, value: number | bigint | undefined) {
  if (value === undefined) return "Pending";
  const index = typeof value === "bigint" ? Number(value) : value;
  return labels[index] ?? `#${index}`;
}

function bountyFromTuple(id: number, data: BountyTuple): BountyRow {
  return {
    id,
    brand: data[0],
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
    lastCheckedAt: data[10],
    nextCheckAt: data[11],
  };
}

function availableFor(row: BountyRow | undefined) {
  return row ? row.totalFunded - row.totalPaid : undefined;
}

const taskPaths: Record<ActiveBountyTask, string> = {
  submit: "/dashboard/clippers",
  verify: "/dashboard/verify",
  create: "/dashboard/brands",
  funds: "/dashboard/funds",
};

export default function ClipBountyApp({ initialTask = "submit" }: ClipBountyAppProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected, publicClient, walletClient } = useWallet();
  const [isPending, setIsPending] = useState(false);
  const [activeTask, setActiveTask] = useState<ActiveBountyTask>(initialTask);

  const [title, setTitle] = useState("First clipper bounty push");
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
  const [registrationName, setRegistrationName] = useState("");

  const [feedback, setFeedback] = useState("");
  const [bountyCount, setBountyCount] = useState<bigint>();
  const [submissionCount, setSubmissionCount] = useState<bigint>();
  const [verificationCost, setVerificationCost] = useState<bigint>();
  const [nativeCredit, setNativeCredit] = useState<bigint>();
  const [profileRole, setProfileRole] = useState<AccountRole>(0);
  const [profileName, setProfileName] = useState("");
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

  const taskTabId = `bounty-task-${activeTask}`;
  const activeLane = activeTask === "create" || activeTask === "funds" ? "brands" : "clippers";
  const connectedAddress = address?.toLowerCase();
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const expectedRole: AccountRole = activeLane === "brands" ? 1 : 2;
  const canUseWorkspace = isConnected && profileRole === expectedRole;
  const registeredAs = profileRole === 1 ? "Brand" : profileRole === 2 ? "Clipper" : "";
  const brandBountyRows = useMemo(() => {
    if (!connectedAddress || profileRole !== 1) return [];
    return bountyRows.filter((row) => row.brand.toLowerCase() === connectedAddress);
  }, [bountyRows, connectedAddress, profileRole]);
  const clipperBountyRows = useMemo(() => {
    if (connectedAddress && profileRole !== 2) return [];
    return bountyRows.filter((row) => {
      const isOwnBrandBounty = connectedAddress ? row.brand.toLowerCase() === connectedAddress : false;
      return (
        !isOwnBrandBounty &&
        row.status === 1 &&
        row.deadline > nowSeconds &&
        row.approvedCount < row.maxPayouts &&
        (availableFor(row) ?? 0n) > 0n
      );
    });
  }, [bountyRows, connectedAddress, nowSeconds, profileRole]);
  const visibleBountyRows = activeLane === "brands" ? brandBountyRows : clipperBountyRows;
  const selectedLoadedBounty =
    selectedBounty && selectedBounty.id.toString() === bountyId && visibleBountyRows.some((row) => row.id === selectedBounty.id)
      ? selectedBounty
      : undefined;
  const selectedVisibleBounty = visibleBountyRows.find((row) => row.id.toString() === bountyId) ?? selectedLoadedBounty;
  const visibleSubmissionRows = useMemo(() => {
    if (!connectedAddress) return [];
    return submissionRows.filter((row) => row.clipper.toLowerCase() === connectedAddress);
  }, [connectedAddress, submissionRows]);

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
      const [credit, profile] = await Promise.all([
        publicClient.readContract({
          address: clipBountyAddress,
          abi: clipBountyAbi,
          functionName: "nativeCredits",
          args: [address],
        }),
        publicClient.readContract({
          address: clipBountyAddress,
          abi: clipBountyAbi,
          functionName: "profiles",
          args: [address],
        }),
      ]);
      const [role, name] = profile as readonly [number, string, bigint];
      setNativeCredit(credit as bigint);
      setProfileRole((role === 1 || role === 2 ? role : 0) as AccountRole);
      setProfileName(name);
    } else {
      setNativeCredit(undefined);
      setProfileRole(0);
      setProfileName("");
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
    void loadContractSnapshot().then((count) => loadBounties(count));
  }, [loadContractSnapshot, loadBounties]);

  useEffect(() => {
    void loadSelectedBounty();
  }, [loadSelectedBounty]);

  useEffect(() => {
    setActiveTask(initialTask);
  }, [initialTask]);

  useEffect(() => {
    if (activeTask === "create") return;
    if (visibleBountyRows.length === 0) {
      if (bountyId) setBountyId("");
      return;
    }
    if (!visibleBountyRows.some((row) => row.id.toString() === bountyId)) {
      setBountyId(visibleBountyRows[0].id.toString());
    }
  }, [activeTask, bountyId, visibleBountyRows]);

  function activateTask(task: ActiveBountyTask) {
    setActiveTask(task);
    const nextPath = taskPaths[task];
    if (pathname !== nextPath) {
      router.push(nextPath);
    }
  }

  function selectBounty(id: number) {
    setBountyId(id.toString());
    if (activeLane === "brands") {
      activateTask("funds");
      return;
    }
    if (activeTask !== "verify") {
      activateTask("submit");
    }
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

  async function onRegisterRole(event: React.FormEvent, role: RegistrationRole) {
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
    if (!registrationName.trim()) {
      setFeedback("Profile name is required.");
      return;
    }

    try {
      const receipt = await writeClipContract({
        functionName: role === "brand" ? "registerBrand" : "registerClipper",
        args: [registrationName.trim()],
      });
      setFeedback(`${role === "brand" ? "Brand" : "Clipper"} registered in block ${receipt.blockNumber.toString()}.`);
      await refreshAfterWrite();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Registration failed.");
    }
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
    if (profileRole !== 1) {
      setFeedback("Register this wallet as a brand first.");
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
      activateTask("funds");
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
    if (profileRole !== 2) {
      setFeedback("Register this wallet as a clipper first.");
      return;
    }

    try {
      const parsedBountyId = parsePositiveInteger(bountyId, "Selected bounty");
      if (!clipUrl.trim()) throw new Error("YouTube URL is required.");
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

  async function onRequestVerification(nextSubmissionId: string | number = submissionId) {
    setFeedback("");
    if (!clipBountyAddress) {
      setFeedback("Clip bounty contract is not configured.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet first.");
      return;
    }
    if (profileRole !== 2) {
      setFeedback("Register this wallet as a clipper first.");
      return;
    }
    if (typeof verificationCost !== "bigint") {
      setFeedback("Verification fee is not available from the contract.");
      return;
    }

    try {
      const parsedSubmissionId = parsePositiveInteger(String(nextSubmissionId), "Submitted clip");
      setSubmissionId(String(parsedSubmissionId));
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
    if (profileRole !== 1) {
      setFeedback("Register this wallet as a brand first.");
      return;
    }

    try {
      const parsedBountyId = parsePositiveInteger(bountyId, "Selected bounty");
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
    if (profileRole !== 1) {
      setFeedback("Register this wallet as a brand first.");
      return;
    }

    try {
      const parsedBountyId = parsePositiveInteger(bountyId, "Selected bounty");
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

  const workspace = {
    submit: {
      label: "Clippers",
      title: "Join bounties",
    },
    verify: {
      label: "Clippers",
      title: "Verify submitted clips",
    },
    create: {
      label: "Brands",
      title: "Create bounties",
    },
    funds: {
      label: "Brands",
      title: "Manage escrow",
    },
  }[activeTask];

  return (
    <section className="clip-app" aria-label={`${workspace.label} Reel workspace`}>
      {feedback ? (
        <div className="clip-app__feedback" role="status">
          <Lock aria-hidden size={14} />
          <span>{feedback}</span>
        </div>
      ) : null}

      <div className={`clip-workspace clip-workspace--${activeLane} clip-workspace--${activeTask}`}>
        <section className="panel clip-list-panel" id={activeLane === "brands" ? "brands" : "clippers"} aria-label="Bounties">
          <div className="panel__head">
            <div>
              <p className="label">{activeLane === "brands" ? "Your brand bounties" : "Open bounties"}</p>
              <strong>{activeLane === "brands" ? "Only campaigns created by this wallet" : "Funded clip work clippers can join"}</strong>
            </div>
            <button
              type="button"
              className="cta cta--ghost cta--compact"
              disabled={!contractEnabled || isPending}
              onClick={() => void refreshAfterWrite()}
            >
              Refresh
            </button>
          </div>
          <div className="panel__body">
            {bountiesError ? <p className="panel-state panel-state--error">{bountiesError}</p> : null}
            {!bountiesError && bountiesLoading ? <p className="panel-state">Loading bounties.</p> : null}
            {!bountiesError && !bountiesLoading && visibleBountyRows.length === 0 ? (
              <p className="panel-state">
                {activeLane === "brands"
                  ? isConnected
                    ? "This wallet has not created a bounty yet."
                    : "Connect wallet to see brand bounties created by your address."
                  : "No funded bounties from other brands are open right now."}
              </p>
            ) : null}
            {!bountiesError && !bountiesLoading && visibleBountyRows.length > 0 ? (
              <div className="clip-list">
                {visibleBountyRows.map((bounty) => {
                  const selected = bounty.id.toString() === bountyId;
                  return (
                    <article className="clip-row-card" data-selected={selected ? "true" : "false"} key={bounty.id}>
                      <div className="clip-row-card__top">
                        <span>{labelFrom(bountyStatusLabels, bounty.status)}</span>
                        <span>Closes {formatDate(bounty.deadline)}</span>
                      </div>
                      <h2>{bounty.title}</h2>
                      <div className="clip-row-card__meta">
                        <span>{formatCount(bounty.minViews)} views</span>
                        <span>{formatNative(bounty.rewardPerClip)} reward</span>
                        <span>{formatNative(availableFor(bounty))} escrow left</span>
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
                          {selected ? "Selected" : activeLane === "brands" ? "Manage" : "Join"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel clip-action-panel" aria-label={workspace.title}>
          <div className="panel__body">
            {!isConnected ? (
              <div className="task-block">
                <div className="task-block__head">
                  <Lock aria-hidden size={18} />
                  <strong>Connect wallet</strong>
                </div>
                <p className="panel-state">Connect before using the {activeLane === "brands" ? "brand" : "clipper"} workspace.</p>
              </div>
            ) : null}

            {isConnected && !canUseWorkspace ? (
              profileRole === 0 ? (
                <form
                  className="task-block"
                  onSubmit={(event) => void onRegisterRole(event, activeLane === "brands" ? "brand" : "clipper")}
                >
                  <div className="task-block__head">
                    <BadgeCheck aria-hidden size={18} />
                    <strong>Register as {activeLane === "brands" ? "Brand" : "Clipper"}</strong>
                  </div>
                  <label className="field field--wide">
                    <span className="label">{activeLane === "brands" ? "Brand name" : "Clipper name"}</span>
                    <input value={registrationName} onChange={(event) => setRegistrationName(event.target.value)} />
                  </label>
                  <div className="form-actions form-actions--end">
                    <button type="submit" className="cta" disabled={writeDisabled} title={writeTitle}>
                      Register {activeLane === "brands" ? "brand" : "clipper"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="task-block">
                  <div className="task-block__head">
                    <Lock aria-hidden size={18} />
                    <strong>{registeredAs} wallet</strong>
                  </div>
                  <p className="panel-state">
                    This wallet is registered as {registeredAs}. Use a different wallet for the{" "}
                    {activeLane === "brands" ? "brand" : "clipper"} workspace.
                  </p>
                </div>
              )
            ) : null}

            {canUseWorkspace && activeTask === "submit" ? (
              <form className="clip-task-panel" id={taskTabId} role="tabpanel" onSubmit={onSubmitClip}>
                <div className="clip-selected">
                  {selectedVisibleBounty ? (
                    <>
                      <div className="clip-selected__top">
                        <span>{labelFrom(bountyStatusLabels, selectedVisibleBounty.status)}</span>
                        <span>Deadline {formatDate(selectedVisibleBounty.deadline)}</span>
                      </div>
                      <h2>{selectedVisibleBounty.title}</h2>
                      <p>{selectedVisibleBounty.rules}</p>
                      <div className="clip-selected__meta">
                        <span>Target {formatCount(selectedVisibleBounty.minViews)} views</span>
                        <span>Reward {formatNative(selectedVisibleBounty.rewardPerClip)}</span>
                        <span>Escrow {formatNative(availableFor(selectedVisibleBounty))}</span>
                      </div>
                    </>
                  ) : (
                    <p className="panel-state">Choose an open bounty before submitting your clipper link.</p>
                  )}
                </div>

                <div className="task-block">
                  <div className="task-block__head">
                    <Send aria-hidden size={18} />
                    <strong>Submit public YouTube URL</strong>
                  </div>
                  <label className="field field--wide">
                    <span className="label">Clipper link</span>
                    <input
                      value={clipUrl}
                      onChange={(event) => setClipUrl(event.target.value)}
                      placeholder="https://www.youtube.com/shorts/..."
                    />
                  </label>
                  <div className="form-actions form-actions--end">
                    <button type="submit" className="cta" disabled={writeDisabled || !selectedVisibleBounty} title={writeTitle}>
                      Submit clip
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {canUseWorkspace && activeTask === "verify" ? (
              <div className="clip-task-panel" id={taskTabId} role="tabpanel">
                <div className="clip-selected">
                  {selectedVisibleBounty ? (
                    <>
                      <div className="clip-selected__top">
                        <span>{labelFrom(bountyStatusLabels, selectedVisibleBounty.status)}</span>
                        <span>Agent fee {formatNative(verificationCost)}</span>
                      </div>
                      <h2>{selectedVisibleBounty.title}</h2>
                      <p>The agent reads your submitted YouTube URL, checks the visible views against this bounty, and triggers escrow payout when it passes.</p>
                    </>
                  ) : (
                    <p className="panel-state">Choose a bounty with a clip submitted from this wallet.</p>
                  )}
                </div>

                <div className="clip-submissions" aria-label="Your submitted clips">
                  <div className="clip-submissions__head">
                    <strong>Your submitted clips</strong>
                    {submissionsLoading ? <span>Loading</span> : null}
                  </div>
                  {visibleSubmissionRows.length === 0 ? (
                    <p className="panel-state">No clips from this wallet are attached to the selected bounty.</p>
                  ) : null}
                  {visibleSubmissionRows.map((submission) => {
                    const canCheckClip = submission.status === 1 || submission.status === 3;
                    return (
                    <article className="clip-submission-row" key={submission.id}>
                      <div>
                        <span>{labelFrom(submissionStatusLabels, submission.status)}</span>
                        <strong>{formatCount(submission.observedViews)} views observed</strong>
                        {submission.status === 3 && submission.nextCheckAt > 0n ? (
                          <span>Next check {formatDate(submission.nextCheckAt)}</span>
                        ) : null}
                      </div>
                      <div>
                        <span>{formatNative(submission.paidAmount)}</span>
                      </div>
                      <a href={submission.clipUrl} target="_blank" rel="noopener noreferrer">
                        YouTube <ExternalLink aria-hidden size={12} />
                      </a>
                      <button
                        type="button"
                        className="cta cta--ghost"
                        disabled={writeDisabled || typeof verificationCost !== "bigint" || !canCheckClip}
                        title={writeTitle}
                        onClick={() => void onRequestVerification(submission.id)}
                      >
                        {submission.status === 3 ? "Check again" : "Check views"}
                      </button>
                    </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {canUseWorkspace && activeTask === "create" ? (
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
                      <input
                        value={campaignUrl}
                        onChange={(event) => setCampaignUrl(event.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
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
                    <span className="form-feedback">The brand wallet funds reward x max payouts when this transaction is signed.</span>
                    <button type="submit" className="cta" disabled={writeDisabled} title={writeTitle}>
                      Create bounty
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {canUseWorkspace && activeTask === "funds" ? (
              <div className="clip-task-panel" id={taskTabId} role="tabpanel">
                <div className="clip-selected">
                  {selectedVisibleBounty ? (
                    <>
                      <div className="clip-selected__top">
                        <span>{labelFrom(bountyStatusLabels, selectedVisibleBounty.status)}</span>
                        <span>Paid {formatCount(selectedVisibleBounty.approvedCount)} / {formatCount(selectedVisibleBounty.maxPayouts)}</span>
                      </div>
                      <h2>{selectedVisibleBounty.title}</h2>
                      <div className="clip-selected__meta">
                        <span>Escrow {formatNative(availableFor(selectedVisibleBounty))}</span>
                        <span>Total funded {formatNative(selectedVisibleBounty.totalFunded)}</span>
                        <span>Total paid {formatNative(selectedVisibleBounty.totalPaid)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="panel-state">Choose one of your brand bounties to manage escrow.</p>
                  )}
                </div>

                <div className="task-block">
                  <div className="task-block__head">
                    <WalletCards aria-hidden size={18} />
                    <strong>Escrow controls</strong>
                  </div>
                  <label className="field">
                    <span className="label">Add STT</span>
                    <input inputMode="decimal" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} />
                  </label>
                  <div className="form-actions form-actions--end">
                    <button
                      type="button"
                      className="cta cta--ghost"
                      disabled={writeDisabled || !selectedVisibleBounty}
                      title={writeTitle}
                      onClick={onCloseBounty}
                    >
                      Close bounty
                    </button>
                    <button
                      type="button"
                      className="cta"
                      disabled={writeDisabled || !selectedVisibleBounty}
                      title={writeTitle}
                      onClick={onFundBounty}
                    >
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
    </section>
  );
}
