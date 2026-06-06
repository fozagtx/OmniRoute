# Somnia Market Console

Native STT binary prediction markets resolved through Somnia Agents. The active contract is `SomniaPredictionMarket`; the dashboard reads and writes through that ABI only.

## What It Does

- Creates YES/NO markets with an evidence URL, close time, and Somnia LLM Parse Website instructions.
- Lets users stake STT directly, deposit native credit, stake from native credit, and claim resolved payouts.
- Lets a user create a bounded policy for an executor: allowed side, max stake per action, max total stake, expiry, and owner-controlled disable.
- Requests resolution through the documented Somnia Agents platform and stores request id, receipt id, response status, and output in contract state.
- Loads recent market events from Somnia RPC and receipt JSON from a user-provided endpoint.

## Verified Somnia Surface

| Network | Chain ID | Native token | Agent platform |
|---|---:|---|---|
| Somnia testnet | 50312 | STT | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| Somnia mainnet | 5031 | SOMI | `0x5E5205CF39E766118C01636bED000A54D93163E6` |

The testnet contract uses the documented LLM Parse Website agent id:

```text
12875401142070969085
```

## Project Layout

```text
contracts/
  src/SomniaPredictionMarket.sol
  src/interfaces/ISomniaAgent.sol
  script/Deploy.s.sol

src/
  app/AgentMarketConsole.tsx
  app/dashboard/
  lib/predictionMarket.ts
  lib/chains.ts
```

## Contracts

```bash
cd contracts
forge build
forge test -vv
```

Deploy to Somnia testnet with Foundry if your local Foundry build supports chain `50312` broadcasts:

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url somnia_testnet --broadcast --slow
```

This machine deployed with `cast send --create` because `forge script --broadcast` rejected Somnia's custom chain id:

```bash
cd contracts
BYTECODE=$(forge inspect src/SomniaPredictionMarket.sol:SomniaPredictionMarket bytecode)
PK=$(awk -F= '$1=="DEPLOYER_PRIVATE_KEY" {print $2}' .env | tr -d '\r')
cast send --rpc-url https://api.infra.testnet.somnia.network/ --private-key "$PK" --legacy --create "$BYTECODE"
```

After deploy, set the printed `SomniaPredictionMarket` address in the dashboard environment.
Current testnet deployment:

```bash
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=0x157337Ee4373Ae2FA7bb2D609bB4EE7ecf0e7e78
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
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

## Flow

1. Create a market with the exact question, evidence URL or domain, resolution prompt, close window, page count, and confidence threshold.
2. Deposit STT native credit if a policy executor will trade from the owner balance.
3. Create a policy with executor address, allowed side, per-action cap, total cap, and expiry.
4. Stake directly, stake from credit, or execute the policy.
5. After close, request resolution and pay the quoted Somnia agent fee.
6. Read the stored outcome, receipt id, response status, pools, position, and events.
7. Claim after the market is resolved.

## Current Deploy Manifest

`deployed-addresses.json` tracks the current `SomniaPredictionMarket` testnet address. The dashboard requires `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS`; without it, writes remain disabled.
