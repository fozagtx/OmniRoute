import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "@/lib/chains";
import { clipBountyAbi, clipBountyAddress } from "@/lib/clipBounty";

export const dynamic = "force-dynamic";

const MAX_RECHECKS_PER_RUN = 4;

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const privateKey = process.env.REEL_AUTOMATION_PRIVATE_KEY as `0x${string}` | undefined;
  if (!clipBountyAddress || !privateKey) {
    return NextResponse.json({ checked: 0, submitted: 0, reason: "Automation is not configured." });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SOMNIA_RPC ?? somniaTestnet.rpcUrls.default.http[0];
  const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: somniaTestnet, transport: http(rpcUrl) });

  const [submissionCount, quote] = await Promise.all([
    publicClient.readContract({
      address: clipBountyAddress,
      abi: clipBountyAbi,
      functionName: "submissionCount",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: clipBountyAddress,
      abi: clipBountyAbi,
      functionName: "quoteVerificationCost",
    }) as Promise<readonly [bigint, bigint, bigint]>,
  ]);

  const fee = quote[2];
  const submitted: Array<{ submissionId: string; hash: string }> = [];
  let checked = 0;

  for (let id = Number(submissionCount); id >= 1 && submitted.length < MAX_RECHECKS_PER_RUN; id -= 1) {
    checked += 1;
    const [ready] = (await publicClient.readContract({
      address: clipBountyAddress,
      abi: clipBountyAbi,
      functionName: "canRequestVerification",
      args: [BigInt(id)],
    })) as readonly [boolean, bigint];

    if (!ready) continue;

    const hash = await walletClient.writeContract({
      address: clipBountyAddress as Address,
      abi: clipBountyAbi,
      functionName: "requestVerification",
      args: [BigInt(id)],
      value: fee,
    });

    submitted.push({ submissionId: String(id), hash });
  }

  return NextResponse.json({ checked, submitted: submitted.length, transactions: submitted });
}
