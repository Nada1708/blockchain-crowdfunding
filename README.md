# Fundora

Fundora is a decentralized crowdfunding application built around ETH funding,
CFD governance tokens, IPFS campaign metadata, and DAO-controlled campaign
decisions. The repository contains the Solidity contracts, a Hardhat 3 local
deployment workflow, and a React/Vite frontend using Ethers.js v6.

## Architecture

```text
React + Vite + TypeScript
  |-- MetaMask / Ethers.js v6 ---- Hardhat Local (chain ID 31337)
  |                                  |-- CFDToken
  |                                  |-- Crowdfunding
  |                                  |-- CFDGovernance
  |                                  `-- MultiSigTreasury
  `-- local secure proxy -------- Pinata / IPFS
```

Campaign metadata and optional images are uploaded through the server-side
Pinata proxy; the browser never receives the Pinata JWT. Campaign and governance
transactions require an explicit MetaMask confirmation. The frontend also keeps
DEMO content visibly separate from data read from the deployed contracts.

## Smart contracts

- **CFDToken** is an ERC-20 governance token with Permit, Votes, checkpoints,
  AccessControl, and automatic self-delegation on first mint. Only authorized
  roles can mint or burn CFD.
- **Crowdfunding** creates campaigns, accepts ETH contributions, mints CFD,
  handles eligible refunds and beneficiary withdrawals, and supports campaign
  cancellation, pause, freeze, and DAO-authorized early release.
- **CFDGovernance** creates Freeze, Unfreeze, and EarlyRelease proposals, records
  snapshot-weighted CFD votes, checks quorum, and executes adopted decisions on
  Crowdfunding.
- **MultiSigTreasury** is a two-of-three signer treasury for submitting,
  confirming, revoking, and executing transactions. It is deployed as part of
  the Fundora stack but is not used as an automatic frontend transaction path.

The Ignition module grants Crowdfunding the CFD minter and burner roles and
grants CFDGovernance the Crowdfunding governance role. The local deployer keeps
the bootstrap admin/pauser roles; MultiSigTreasury is a tested standalone 2-of-3
treasury and is not yet the administrator of the application contracts.

## Repository layout

```text
contracts/                 Solidity contracts and Solidity tests
ignition/modules/Fundora.ts
                           Hardhat Ignition deployment and role wiring
scripts/                   ABI export and local deployment verification
test/                      TypeScript/Mocha tests, including Fundora integration
frontend/                  React application and secure Pinata proxy
docs/LOCAL_DEPLOYMENT.md   Detailed local deployment instructions
```

Generated Hardhat artifacts, caches, local Ignition deployment journals, and
all local environment files are intentionally excluded from Git. Source files,
ABI modules, deployment scripts, tests, documentation, and `.env.example`
templates are versioned.

## Prerequisites

- Windows 11 with PowerShell (the documented commands use `*.cmd`), Git,
  Node.js 24 and npm
- MetaMask for manual transaction flows
- A Pinata JWT only when testing IPFS uploads; keep it in
  `frontend/server/.env`, never in a `VITE_*` variable

For a clean installation on another computer, follow the French step-by-step
guide: [`docs/DEMARRAGE_FUNDORA.md`](docs/DEMARRAGE_FUNDORA.md). It covers the
local Hardhat network, MetaMask, contract deployment, Express/SIWE, Vite, IPFS,
tests, and troubleshooting.

Install the locked contract and frontend dependencies from the repository root:

```powershell
npm.cmd ci
npm.cmd --prefix frontend ci
```

## Compile and test

Run the complete Hardhat test suite:

```powershell
npx.cmd hardhat test
```

Validate the frontend:

```powershell
Set-Location frontend
npm.cmd run lint
npm.cmd run test:frontend
npm.cmd run test:api
npm.cmd run build
```

The suite includes Solidity tests and a TypeScript integration test using the
real CFDToken, Crowdfunding, and CFDGovernance contracts and their required
roles.

## Hardhat local deployment

Keep a local node running in one terminal:

```powershell
npx.cmd hardhat node --hostname 127.0.0.1 --port 8545
```

Deploy the four contracts from a second terminal:

```powershell
npx.cmd hardhat ignition deploy ignition/modules/Fundora.ts --network localhost --deployment-id fundora-local
```

Then verify the links and roles and export the ABIs consumed by React:

```powershell
node scripts/verify-local-deployment.mjs
node scripts/export-frontend-abis.mjs
```

Copy `frontend/.env.example` to an ignored `frontend/.env.local` and enter the
public addresses emitted by the deployment. Local deployment addresses are not
portable across a reset of the Hardhat node. See
[`docs/LOCAL_DEPLOYMENT.md`](docs/LOCAL_DEPLOYMENT.md) for the complete reset and
restart workflow.

## Frontend and IPFS

Copy the two templates before starting the application (both resulting files
are ignored by Git):

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item frontend/server/.env.example frontend/server/.env
```

Use three terminals after the Hardhat node and deployment are ready:

```powershell
# Terminal A — contracts
npx.cmd hardhat node --hostname 127.0.0.1 --port 8545

# Terminal B — SIWE and IPFS API
npm.cmd --prefix frontend run server

# Terminal C — React
npm.cmd --prefix frontend run dev
```

The first three standard Hardhat accounts are the MultiSigTreasury signers;
account zero is also the local bootstrap admin/pauser. Import only accounts intended for local
testing into MetaMask; never publish or reuse their development keys.

Frontend setup, routes, wallet behavior, and implemented transaction flows are
documented in [`frontend/README.md`](frontend/README.md). Secure Pinata proxy
configuration is documented in [`frontend/IPFS.md`](frontend/IPFS.md).

No private key, mnemonic, JWT, or secret RPC credential belongs in Git. Only the
documented `.env.example` templates should be shared.
