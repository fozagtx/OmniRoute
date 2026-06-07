# Reel

Native STT clip bounties verified through Somnia Agents. YouTube view verification is the live first network; the active contract is `ReelBounty`, and the dashboard reads and writes through that ABI only.

## What It Does

- Lets brands fund a Reel campaign with campaign URL, rules, minimum views, reward per clip, max payouts, and deadline.
- Lets clippers submit public YouTube URLs against a live bounty.
- Requests verification through Somnia's LLM Parse Website agent and records the observed public view count.
- Pays qualified clippers directly from escrow and lets the brand close the bounty to refund unused STT.
- Keeps bounty state, submission state, request ids, observed views, and payout amounts on-chain.

## Verified Somnia Surface

| Network | Chain ID | Native token | Agent platform |
|---|---:|---|---|
| Somnia testnet | 50312 | STT | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| Somnia mainnet | 5031 | SOMI | `0x5E5205CF39E766118C01636bED000A54D93163E6` |

The testnet contract uses the documented LLM Parse Website agent id:

```text
12875401142070969085
```

The agent reads the submitted public URL. In the current live flow that URL is YouTube, where it can check page-visible data such as view count; it is not given a user's private analytics account.

## Project Layout

```text
contracts/
  src/ReelBounty.sol
  src/interfaces/ISomniaAgent.sol
  script/Deploy.s.sol
  test/ReelBounty.t.sol

src/
  app/ClipBountyApp.tsx
  app/dashboard/
  lib/clipBounty.ts
  lib/chains.ts
```

## Contracts

```bash
cd contracts
forge build
forge test -vv
```

Deploy to Somnia testnet:

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url somnia_testnet --broadcast --slow
```

Direct deploy command for this machine:

```bash
cd contracts
BYTECODE=$(forge inspect src/ReelBounty.sol:ReelBounty bytecode)
PK=$(awk -F= '$1=="DEPLOYER_PRIVATE_KEY" {print $2}' .env | tr -d '\r')
cast send --rpc-url https://api.infra.testnet.somnia.network/ --private-key "$PK" --legacy --create "$BYTECODE"
```

After deploy, set the printed `ReelBounty` address in the dashboard environment:

```bash
NEXT_PUBLIC_CLIP_BOUNTY_ADDRESS=0xd675eA5418b10888Ef74243c739831db85B42676
```

## Dashboard

```bash
pnpm install
cp .env.example .env.local
pnpm typecheck
pnpm build
pnpm dev
```

Required environment:

```text
NEXT_PUBLIC_SOMNIA_RPC=https://api.infra.testnet.somnia.network
NEXT_PUBLIC_CLIP_BOUNTY_ADDRESS=
CRON_SECRET=
REEL_AUTOMATION_PRIVATE_KEY=
```

## Flow

1. Create a funded bounty with a campaign URL, rules, view threshold, reward per approved post, max payouts, and deadline.
2. Submit a public URL against the bounty. Today that URL must be YouTube.
3. Request Somnia verification for a submission and pay the quoted agent fee.
4. The callback records the observed view count. If the clip is under target, it can be checked again after 30 minutes.
5. If the count meets the threshold and escrow capacity remains, the contract pays the clipper directly.
6. The brand can close the bounty and receive unused escrow back.

## Scheduled Checks

The app exposes `/api/recheck-submissions`. It scans submitted clips and sends a real on-chain check when a clip is ready.

- Vercel runs it once daily on the Hobby plan.
- GitHub Actions calls the same endpoint every 30 minutes with `CRON_SECRET`.
- `REEL_AUTOMATION_PRIVATE_KEY` pays the Somnia agent fee; payout still goes to the clipper wallet.

## Current Somnia Testnet Deployment

| Field | Value |
|---|---|
| Contract | `0xd675eA5418b10888Ef74243c739831db85B42676` |
| Deploy tx | `0x8675a3be6ddfda12f156d24fd2b532e1eb17a1e88c9225a858842260290cede2` |
| Owner | `0xBb67c7386e1e4Fb9931129CA09FE577F4B3fFb97` |
| Cron operator | `0xBb67c7386e1e4Fb9931129CA09FE577F4B3fFb97` |
| Agent | LLM Parse Website `12875401142070969085` |

## Current Deploy Manifest

`deployed-addresses.json` tracks the current `ReelBounty` testnet address. The dashboard requires `NEXT_PUBLIC_CLIP_BOUNTY_ADDRESS`; without it, writes remain disabled.

Current testnet deployment:

```text
0xd675eA5418b10888Ef74243c739831db85B42676
```
