# Repository Guidelines

## Project Structure & Module Organization

OmniRoute is split into two independent workspaces. `contracts/` is a Foundry Solidity project with source in `contracts/src/`, deploy logic in `contracts/script/Deploy.s.sol`, vendored libraries in `contracts/lib/`, and build artifacts in `contracts/out/` and `contracts/cache/`. `dashboard/` is a Next.js app with routes and panels in `dashboard/src/app/`, shared chain and contract helpers in `dashboard/src/lib/`, and static assets in `dashboard/public/`. Agent metadata lives in `agents/`; deployed addresses are tracked in `deployed-addresses.json`.

## Build, Test, and Development Commands

Run contract commands from `contracts/`:

```bash
forge build
forge script script/Deploy.s.sol --rpc-url somnia_testnet --broadcast --slow
```

Run dashboard commands from `dashboard/`:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

`pnpm dev` starts the local dashboard. `pnpm typecheck` runs `tsc --noEmit`; `pnpm build` validates the production Next.js build.

## Coding Style & Naming Conventions

Use Solidity `0.8.30` and keep Foundry settings aligned with `contracts/foundry.toml` (`via_ir`, optimizer 200, EVM Cancun). Solidity contracts use PascalCase filenames and contract names; interfaces live under `contracts/src/interfaces/` with `I` prefixes. Dashboard code uses TypeScript, React function components, PascalCase component files, and camelCase utilities. Keep panel-level UI in `src/app/` and chain/ABI logic in `src/lib/`.

## Testing Guidelines

There is currently no automated test suite in this checkout: `contracts/test/` is empty and the dashboard has no `test` script. Before opening changes, run `forge build`, `pnpm typecheck`, and `pnpm build` for the areas touched. If tests are added later, prefer Foundry tests under `contracts/test/*.t.sol` and colocated dashboard tests named `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

No usable commit history is present in this workspace, so use concise imperative commit subjects such as `Update escrow ABI bindings` or `Fix dashboard chain config`. PRs should describe the changed contract or dashboard surface, list verification commands run, link related issues, and include screenshots for UI changes. Never include assistant attribution trailers in commits or PR text.

## Security & Configuration Tips

Keep secrets in `.env` files only; never commit private keys, wallet project IDs, or relayer credentials. Use `dashboard/.env.example` and `contracts/.env.example` as templates, and update `deployed-addresses.json` when contract addresses change.
