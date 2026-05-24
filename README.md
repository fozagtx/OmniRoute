# OmniRoute — Agentic Liquidity Router

Cross-border settlement router that uses Somnia Phase 1 Agents (`JSON API Request` + `LLM Inference`) inside the validator consensus loop. Stage 1 fetches the FX rate via JSON API agent; Stage 2 asks the Qwen3-30B inference agent to APPROVE or REJECT the rate. On APPROVE the contract releases escrowed ERC-20 funds to a destination off-ramp vault and emits a `SettlementReceipt`; otherwise the depositor is refunded. No third-party oracle is needed; transfers settle through on-chain callbacks.

## Why OmniRoute is different

A user in country A wants to pay a recipient in country B's currency. They deposit a stablecoin, the chain itself agrees on the FX rate, and the converted amount lands in the destination vault — all in one transaction, with the rate determined by validator consensus rather than a trusted oracle.

What separates this from a normal swap or bridge:

- **No third-party oracle.** The FX rate comes from the chain's own validator subcommittee reaching threshold consensus over a read-only HTTP+JSONPath call — settled in the same block as the transfer. Not Chainlink, not a push-feed contract, not an off-chain execution cron.
- **Two-stage agent pipeline in consensus.** A JSON API agent fetches the rate; a Qwen3-30B inference agent independently approves or rejects it. Both stages run under subcommittee quorum before any funds move.
- **Sybil-gated depositors.** Every depositor must be Self Protocol verified (one-human-per-nullifier ZK proof originating on Celo, mirrored to Somnia via a relayer). The escrow refuses unverified addresses.
- **Agent-native, not oracle-driven.** The router is itself an ERC-8004 registered agent with its own on-chain wallet, AgentCard, and `execute()` hook — a first-class on-chain actor with its own tx history.
- **Reactive by construction.** A Reactor contract subscribes to settlement events through Somnia's native Reactivity precompile, so downstream consumers (the dashboard, other agents) receive pushed updates without polling.
- **Deterministic refunds.** If quorum fails or the agent times out, the depositor is automatically refunded — escrowed token *and* gas reserve — in the same callback. No manual reclaim, no stuck funds.

## Deployed contracts (Somnia testnet · chain 50312)

All five contracts deployed 2026-05-24 from `0xBb67c7386e1e4Fb9931129CA09FE577F4B3fFb97` on Somnia testnet. Solidity 0.8.30 · via_ir · optimizer 200 · EVM cancun.

| Contract | Address | Status |
|---|---|---|
| `IdentityRegistry8004` | [`0x9FdF3029366685370a343Dd917bA90239420120e`](https://shannon-explorer.somnia.network/address/0x9FdF3029366685370a343Dd917bA90239420120e) | Deployed |
| `SelfNullifierGate`    | [`0x8d089e5Cf981c8C36981ba1140Cc9FE68180D8b7`](https://shannon-explorer.somnia.network/address/0x8d089e5Cf981c8C36981ba1140Cc9FE68180D8b7) | Deployed |
| `OmniRouteAgent`       | [`0x535352E64649783975d37E1dC0238F3bD0D57B33`](https://shannon-explorer.somnia.network/address/0x535352E64649783975d37E1dC0238F3bD0D57B33) (AgentID `1`) | Deployed |
| `OmniRouteEscrow`      | [`0xf9e56cC9A6c61637fE378f089842d0E778E7f20b`](https://shannon-explorer.somnia.network/address/0xf9e56cC9A6c61637fE378f089842d0E778E7f20b) | Deployed |
| `OmniRouteReactor`     | [`0xfbEec8d48A5ac3d7A2493B707B57344eb5f540C9`](https://shannon-explorer.somnia.network/address/0xfbEec8d48A5ac3d7A2493B707B57344eb5f540C9) (subs `1688529` / `1688530`) | Deployed |

**Wiring:** subcommittee size **5**, consensus threshold **3**, request timeout **30 s**, off-ramp vault `0x73dD81a4C5d67E831291a4Bc49B26D590dee3caD`. Agent IDs consumed: JSON API `13174292974160097713`, LLM Inference (Qwen3-30B) `12847293847561029384`. Reactor opened two subscriptions on the precompile (`0x...0100`) — one per event topic. Full machine-readable manifest at [`deployed-addresses.json`](./deployed-addresses.json).

## Layout

```
omniroute/
├── contracts/             Foundry workspace (Solidity 0.8.30)
│   ├── src/
│   │   ├── OmniRouteEscrow.sol
│   │   └── interfaces/ISomniaAgent.sol
│   └── script/Deploy.s.sol
└── src/                   Next.js 16 + wagmi v2 dashboard
```

## Verified Somnia surface (May 2026 docs)

| | Mainnet | Testnet (Shannon) |
|---|---|---|
| Chain ID | 5031 | 50312 |
| RPC | api.infra.mainnet.somnia.network | api.infra.testnet.somnia.network |
| Native | SOMI | STT |
| Agent platform | `0x5E5205CF39E766118C01636bED000A54D93163E6` | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |

Interface used: `IAgentRequester.createAdvancedRequest(...)`; callback is the documented
`handleResponse(uint256, Response[], ResponseStatus, Request)` with `msg.sender ==
platform` gating. Deposit model matches the docs: `getAdvancedRequestDeposit(size)`
funds the operations reserve, `rewardPerAgent × size` funds the agent reward pot.

## Flow

```
user.approve(token) ──► requestTransfer{value: reserve + reward + tip}
                          │
                          ├─ ERC-20 escrowed in contract
                          └─ platform.createAdvancedRequest(JSON_API_AGENT_ID, …)
                                │
                Somnia subcommittee (5 validators) → fetchUint(url, jsonpath, 8)
                                │
                          handleResponse(requestId, responses, status, details)
                                ├─ threshold-quorum decode of FX rate
                                ├─ payout = amountIn × rate / 1e8 (slippage gated)
                                ├─ token → offRampVault            (Success)
                                ├─ token → depositor              (Failed/TimedOut)
                                └─ gasEscrow → depositor          (rebate)
```

## Contracts

```bash
cd contracts
forge build
forge test -vv
```

Current note: this checkout has no Foundry test functions, so `forge test -vv`
compiles and reports `No tests found in project!`.

Deploy (set `AGENT_PLATFORM`, `JSON_API_AGENT_ID`, `OFF_RAMP_VAULT`, `DEPLOYER_PRIVATE_KEY`):

```bash
forge script script/Deploy.s.sol --rpc-url somnia_testnet --broadcast
```

## Dashboard

```bash
pnpm install
cp .env.example .env.local      # fill NEXT_PUBLIC_ESCROW_ADDRESS + WalletConnect ID
pnpm dev
```

Live production dashboard:

```text
https://omniroute.vercel.app
```

## Current test flow

The deployed test flow is intentionally limited to one pair so it can be tested
end-to-end without unsupported currency options:

| Field | Current value |
|---|---|
| Source token | Somnia testnet USDC `0xB2614c8E833ef0Caafccc4978D366378ae383169` |
| Destination pair | `USDC / EUR` |
| Rate URL stored in escrow job | `https://api.coinbase.com/v2/exchange-rates?currency=USDC` |
| JSON path stored in escrow job | `data.rates.EUR` |
| Escrow | `0xf9e56cC9A6c61637fE378f089842d0E778E7f20b` |

The dashboard writes the direct Coinbase URL and JSON path into
`createScheduledTransfer(...)`. The cron endpoint does not fetch market data; it
only calls `checkScheduledTransfer(jobId)` on `OmniRouteEscrow`. The contract then
pays the Somnia JSON API agent to read the stored URL/path and returns the rate
through the platform callback.

The scheduled trigger condition is:

```text
currentRate >= targetRate
```

Where funds go:

- On success, the escrow sends the deposited USDC to the configured off-ramp
  vault: `0x73dD81a4C5d67E831291a4Bc49B26D590dee3caD`.
- The `destinationAccount` is not an on-chain token recipient. It is recorded in
  the escrow job/events so the off-ramp can reconcile the EUR payout off-chain.
- There is no user self-withdraw function in the current vault flow. Withdrawal
  means the off-ramp operator releases the corresponding EUR payout after seeing
  the settlement event and destination reference.
- If the rate check fails, the target is not met, the LLM rejects the rate, or
  slippage fails, the deposited USDC is refunded to the depositor.
- Unspent native STT reserved for agent/cron work is rebated to the depositor.

For a fast trigger test, use a target below the current EUR quote, for example
`0.80` when Coinbase returns about `0.86`. For a waiting test, use a target above
the current quote, for example `0.90`.

Testing steps:

1. Open `https://omniroute.vercel.app`.
2. Connect a wallet on Somnia testnet.
3. Make sure the wallet has STT gas and Somnia testnet USDC.
4. The wallet must be verified by `SelfNullifierGate`; otherwise the escrow
   reverts with `DepositorNotVerified`.
5. Enter the USDC amount and minimum output.
6. Approve USDC for the escrow.
7. Connect the settlement card to automation.
8. Set a target rate and keep max checks at `5` for the current test.
9. Run the scheduled transfer.

Cron is deployed at `/api/cron/check-scheduled` and protected by `CRON_SECRET`.
On Vercel Hobby, the automatic schedule is daily, so manual authorized hits can be
used during testing to trigger `checkScheduledTransfer(jobId)` immediately after a
job exists.

## Performance targets (PRD §5)

| Metric | Target | How to verify |
|---|---|---|
| End-to-end latency | < 1.2 s | Block-timestamp delta between `TransferRequested` and `TransferSettled` |
| Gas efficiency | sub-cent | add Foundry tests, then run `forge test --gas-report` on `OmniRouteEscrow` |
| Consensus determinism | 100% | `fetchUint` is read-only HTTP+JSONPath — no LLM seeding required |


# OmniRoute — Add-on Layer (ERC-8004 + Self + Agent Wallet)

This document supplements the main `README.md` and describes the **agent-to-agent
stack** layered on top of the core OmniRoute escrow.

## What changed vs the core build

| Component | Status |
|---|---|
| `IdentityRegistry8004.sol` | **new** · singleton-per-chain ERC-8004 IdentityRegistry on Somnia |
| `SelfNullifierGate.sol` | **new** · Self Protocol gate, accepts relayer-attested proofs from Celo Hub V2 |
| `OmniRouteAgent.sol` | **new** · smart-contract agent wallet; self-registers, holds AgentID, executes settlements |
| `OmniRouteEscrow.sol` | **refactored** · `requestTransfer` now gates on `selfGate.isVerified(msg.sender)` |
| `agents/agentCard.json` | **expected** · publish an ERC-8004 AgentCard to IPFS and link it from the registry |
| Test suite | **missing in this checkout** · `forge test -vv` currently reports no tests |

## Architecture

```
                    Celo (existing infra)                 Somnia (our chain)
   ┌────────────────────────────────┐         ┌──────────────────────────────────┐
   │ Self IdentityVerificationHubV2 │  ─────▶ │ SelfNullifierGate                │
   │  - verifies ZK passport proof  │ relayer │  - scope = keccak(gate,seed)     │
   │  - emits {nullifier, scope}    │ multisig│  - one-time-use nullifier map    │
   └────────────────────────────────┘  sig    └──────────────┬───────────────────┘
                                                              │ isVerified(user)
                                                              ▼
   ┌────────────────────────────────┐         ┌──────────────────────────────────┐
   │ ERC-8004 IdentityRegistry      │ ◀─────  │ OmniRouteEscrow                  │
   │  - ERC-721, register(URI)      │  agent  │  - requires verified depositor   │
   │  - AgentCard URI on-chain      │  metadata│  - delegates settlement to agent │
   └──────────────┬─────────────────┘         └──────────────┬───────────────────┘
                  │ owns AgentID                              │ operator role
                  ▼                                           ▼
                ┌──────────────────────────────────────────────────┐
                │ OmniRouteAgent (smart-contract wallet)           │
                │  - self-mints AgentID at deploy                  │
                │  - holds own SOMI balance                        │
                │  - execute(target, value, data) onlyOwner        │
                └──────────────────────────────────────────────────┘
```

## Deploy order

```bash
# 1. set env (see contracts/.env.example)
export DEPLOYER_PRIVATE_KEY=0x...
export AGENT_PLATFORM=0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
export JSON_API_AGENT_ID=13174292974160097713   # testnet JSON-API base agent constant
export LLM_INFERENCE_AGENT_ID=12847293847561029384
export OFF_RAMP_VAULT=<gateway address>
export SELF_RELAYER=<multisig signer address>
export AGENT_CARD_URI=ipfs://<cid-of-agentCard.json>
export CONTRACT_OWNER=<your address>

# 2. broadcast — deploys all 5 contracts in order
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url somnia_testnet \
  --broadcast \
  --slow
```

The script will print:
```
IdentityRegistry8004  0x…
SelfNullifierGate     0x…
OmniRouteAgent        0x…    agentId 1
OmniRouteEscrow       0x…
OmniRouteReactor      0x…
```

## Post-deploy

1. Publish `agents/agentCard.json` to IPFS (replace `<deployed-address>` placeholders
   with the printed addresses first) and update the AgentCard URI on-chain:
   `OmniRouteAgent.updateAgentCardURI("ipfs://<final-cid>")`.
2. Fund `OmniRouteAgent` with SOMI for future executions: send native tokens to
   its address.
3. Stand up the off-chain Self attestation relayer:
   - On Celo, listen for `IdentityVerificationHubV2` events.
   - On valid proofs, sign `keccak256(user, nullifier, scope, deadline)` with the
     multisig key and serve it via a simple HTTP endpoint.
   - The dashboard calls that endpoint, then submits `gate.verify(...)` on Somnia
     before its first `requestTransfer`.

## Why these specific three primitives

- **ERC-8004** gives the agent a portable, censorship-resistant identifier that
  other agents can discover and rate. Live on Ethereum mainnet since Jan 29, 2026.
- **Self Protocol** ensures one-verified-human-per-nullifier — Sybil resistance
  without holding KYC data. Hub V2 lives on Celo; we mirror via relayer.
- **Smart-contract agent wallet** makes the agent a first-class on-chain actor
  with its own balance, its own tx history, and `execute()` as a generic signing
  hook for any future capability.

Together: a verified-human-backed, registered, self-custody agent that emits real
on-chain settlement transactions — the three checkpoints you flagged.
