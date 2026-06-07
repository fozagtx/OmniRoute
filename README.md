# Reel

Native STT creator bounties verified through Somnia Agents. YouTube view verification is the live first network; the active contract is `SomniaClipBounty`, and the dashboard reads and writes through that ABI only.

## What It Does

- Lets a creator fund a Reel campaign with campaign URL, rules, minimum views, reward per post, max payouts, and deadline.
- Lets creators submit public URLs against a live bounty. The current contract accepts YouTube URLs for live verification.
- Requests verification through Somnia's LLM Parse Website agent and records the observed public view count.
- Pays qualified creators directly from escrow and lets the funder close the bounty to refund unused STT.
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
  src/SomniaClipBounty.sol
  src/interfaces/ISomniaAgent.sol
  script/Deploy.s.sol
  test/SomniaClipBounty.t.sol

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
BYTECODE=$(forge inspect src/SomniaClipBounty.sol:SomniaClipBounty bytecode)
PK=$(awk -F= '$1=="DEPLOYER_PRIVATE_KEY" {print $2}' .env | tr -d '\r')
cast send --rpc-url https://api.infra.testnet.somnia.network/ --private-key "$PK" --legacy --create "$BYTECODE"
```

After deploy, set the printed `SomniaClipBounty` address in the dashboard environment:

```bash
NEXT_PUBLIC_CLIP_BOUNTY_ADDRESS=0xee6ff9ce73148bd983fcf515bde168468f4f431e
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
```

## Flow

1. Create a funded bounty with a campaign URL, rules, view threshold, reward per approved post, max payouts, and deadline.
2. Submit a public URL against the bounty. Today that URL must be YouTube.
3. Request Somnia verification for a submission and pay the quoted agent fee.
4. The callback records the observed view count.
5. If the count meets the threshold and escrow capacity remains, the contract pays the creator directly.
6. The creator can close the bounty and receive unused escrow back.

## Live Somnia Testnet Run

Run completed against the deployed contract on Somnia testnet.

| Field | Value |
|---|---|
| Contract | `0xee6ff9ce73148bd983fcf515bde168468f4f431e` |
| Wallet | `0xBb67c7386e1e4Fb9931129CA09FE577F4B3fFb97` |
| Bounty ID | `1` |
| Submission ID | `1` |
| YouTube URL | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` |
| Agent | LLM Parse Website `12875401142070969085` |
| Request ID | `5193632` |
| Verification fee | `0.33 STT` |
| Observed views | `1,780,144,708` |
| Submission status | `Paid` |
| Payout | `0.001 STT` |

Live transactions:

| Step | Transaction |
|---|---|
| Deploy | `0x8526c8f1b2f7f4674acfe09bfdc37c00358b2a02cc477a428a419d71dfc9285a` |
| Create bounty | `0x16d6f915c2c3fdc13172bd6d6b81031ddd875c15f44b30a3fcfb3ada5eea290e` |
| Submit clip | `0xcb92be899ad0835c9462d1dbf00bc2dcbfe5fa962dccac66a2bdaf158db37f33` |
| Request verification | `0x26255d3cade8f01b8a024c554e325ba8778645e6e305d44fe70d977ad997930a` |

## Current Deploy Manifest

`deployed-addresses.json` tracks the current `SomniaClipBounty` testnet address. The dashboard requires `NEXT_PUBLIC_CLIP_BOUNTY_ADDRESS`; without it, writes remain disabled.

Current testnet deployment:

```text
0xee6ff9ce73148bd983fcf515bde168468f4f431e
```
