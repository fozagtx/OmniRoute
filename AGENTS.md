# Repository Guidelines

## Project Structure

Somnia Market Console has two workspaces:

- `contracts/` is a Foundry Solidity project. Main source lives in `contracts/src/SomniaPredictionMarket.sol`, Somnia agent interfaces in `contracts/src/interfaces/`, and deploy logic in `contracts/script/Deploy.s.sol`.
- `src/` is a Next.js dashboard. App routes and panels live in `src/app/`; chain and ABI bindings live in `src/lib/`.

`deployed-addresses.json` is a manifest for the current Somnia testnet deployment once the market contract is broadcast.

## Commands

Run contract commands from `contracts/`:

```bash
forge build
forge test -vv
forge script script/Deploy.s.sol --rpc-url somnia_testnet --broadcast --slow
```

Run dashboard commands from the repo root:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

## Style

Use Solidity `0.8.30` and keep Foundry settings aligned with `contracts/foundry.toml` (`via_ir`, optimizer 200, EVM Cancun). Solidity contracts use PascalCase filenames and contract names. TypeScript uses React function components, PascalCase component files, and camelCase utilities.

Keep contract ABI and dashboard binding changes synchronized: `contracts/src/SomniaPredictionMarket.sol` and `src/lib/predictionMarket.ts` must describe the same public surface.

## Testing

Before shipping changes, run:

```bash
cd contracts && forge build && forge test -vv
pnpm typecheck
pnpm build
```

Use browser tools only when explicitly allowed by the user.

## Security

Keep private keys, wallet project IDs, and deploy secrets in local `.env` files only. Never commit secrets. The dashboard must read live chain state through configured RPC and contract addresses.

## Commits

Use concise imperative commit subjects. Never include assistant attribution trailers in commits or PR text.
