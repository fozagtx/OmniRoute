# Somnia Markets

Native STT binary prediction markets resolved through Somnia Agents. The active contract is `SomniaPredictionMarket`; the dashboard reads and writes through that ABI only.

## What It Does

- Creates YES/NO markets from configured source presets: question, evidence URL, close time, and Somnia LLM Parse Website instructions.
- Lets users stake STT directly, deposit native credit, stake from native credit, and claim resolved payouts.
- Lets a user create a bounded policy for an executor: allowed side, max stake per action, max total stake, expiry, and owner-controlled disable.
- Requests resolution through the documented Somnia Agents platform and stores request id, receipt id, response status, and output in contract state.
- Loads recent market events from Somnia RPC and links only to resolver receipt IDs recorded on-chain.

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
  app/AgentMarketApp.tsx
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

1. Create a market from a configured source preset. The app supplies the question, evidence URL, resolution prompt, page count, and confidence threshold.
2. Deposit STT native credit if a policy executor will trade from the owner balance.
3. Create a policy with executor address, allowed side, per-action cap, total cap, and expiry.
4. Stake directly, stake from credit, or execute the policy.
5. After close, request resolution and pay the quoted Somnia agent fee.
6. Read the stored outcome, receipt id, response status, pools, position, and events.
7. Claim after the market is resolved.

## Live Somnia Testnet Run

Run completed against the deployed contract on Somnia testnet.

| Field | Value |
|---|---|
| Contract | `0x157337Ee4373Ae2FA7bb2D609bB4EE7ecf0e7e78` |
| Wallet | `0xBb67c7386e1e4Fb9931129CA09FE577F4B3fFb97` |
| Market ID | `1` |
| Evidence URL | `https://docs.somnia.network/agents` |
| Agent | LLM Parse Website `12875401142070969085` |
| Request ID | `4964936` |
| Resolution fee | `0.33 STT` |
| Final status | `Resolved` |
| Final outcome | `YES` |
| Agent output | `YES` |
| Response status | `Success` |
| YES pool | `0.02 STT` |
| NO pool | `0.005 STT` |
| Claimed payout | `0.025 STT` |

Live transactions:

| Step | Transaction |
|---|---|
| Deploy | `0xfbba6cffcc1c6e3f104c89a1ebea3da458316958b5822969e29b1a29ccb950f0` |
| Create market | `0x09f46652a5ba97533ee10c9fa70d113785a72c06cdbf8a8f2f11a02127ffc900` |
| Deposit native credit | `0x11b4540eb570b74167fa0902d3fa0d98f9e2b60925148aa8b4172e6b1a276329` |
| Direct YES stake | `0xe59d5a70bdd5db234bcfd1099a89c808edf26b2658d7a5e1f0306d2e6edcb5f4` |
| Create policy | `0x01a282f460a8bd0e08e8dfb6cd7b0d346d9f7c34065dd936f1d16d6ecae31bd6` |
| Execute policy | `0xc64cc11485f87d6b1dc309bae9fa1c19218691cb3ca7273ec2a91b996a42b673` |
| Stake from credit | `0x2506bb22fb02ee202a311ae5b7a85c45349ed24fe23e12d0aac4aaf799609ce3` |
| Request resolution | `0x20c30cdcbbbbd927849f4d467c7f9dc2db9f7c979161e36b4057ccbd7f9eee4a` |
| Claim payout | `0xf0605fef5deb02fa50c4de7c490163165bfe546c4afd9c04ae2c5d23c0f403c4` |

The market's `evidenceUrl` is the source the Somnia agent read. The dashboard now selects this from configured sources, stores it in contract state, and includes it in the `ExtractString(...)` payload sent to the Somnia Agents platform.

## Current Deploy Manifest

`deployed-addresses.json` tracks the current `SomniaPredictionMarket` testnet address. The dashboard requires `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS`; without it, writes remain disabled.
