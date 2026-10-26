# Fundora frontend

Fundora's frontend is a React 19, TypeScript, and Vite application using React
Router, Ethers.js v6, MetaMask, i18next, and a server-side Pinata proxy. It is
responsive, supports Light/Dark themes and English/French translations, and
keeps DEMO records explicitly separate from on-chain records.

## Implemented features

- Responsive Home, Campaigns, Create Campaign, and Governance routes.
- MetaMask connection, account/network change tracking, local disconnect state,
  CFD balance and voting-power display, and an explicit switch/add flow for the
  Hardhat Local network (`31337`).
- Public campaign and governance reads without requiring a connected wallet.
- Campaign metadata and optional image upload to IPFS through the secure local
  Pinata proxy.
- Campaign creation after IPFS upload, ETH contributions, eligible refunds,
  creator cancellation, and DAO-authorized beneficiary withdrawals.
- DAO proposal creation for Freeze and EarlyRelease, duplicate-proposal guards,
  snapshot-weighted voting, and execution of succeeded proposals.
- Transaction lifecycle feedback for MetaMask confirmation, pending receipts,
  rejection, contract errors, and success, followed by automatic data refresh.
- Financial labels that distinguish historical funds raised, refunds,
  withdrawals, and funds still available based on contract state and events.

Every write is initiated by a user click and requires MetaMask confirmation.
Fundora does not switch networks, upload to IPFS, or submit blockchain
transactions automatically.

## Local setup

Requirements: Node.js LTS, npm, and (for write flows) MetaMask connected to a
running Fundora Hardhat deployment.

```powershell
npm install
npm.cmd run dev
```

Vite serves the application at `http://localhost:5173` by default.

Validate the frontend with:

```powershell
npm.cmd run lint
npm.cmd run build
```

## Routes

- `/` — Fundora landing page and clearly labelled DEMO featured campaigns.
- `/campaigns` — searchable DEMO catalogue plus live on-chain campaigns and
  their permitted contribution/refund/cancellation/withdrawal actions.
- `/create` — accessible campaign validation, preview, optional IPFS upload,
  and explicit on-chain campaign creation.
- `/governance` — DEMO proposals plus live proposal creation, voting, and
  execution when allowed by CFDGovernance.

## Contracts and local network

The ABI modules in `src/abi/` are exported from the real Hardhat artifacts for
CFDToken, Crowdfunding, and CFDGovernance. Contract helpers and read/write
services live under `src/services/`; they validate configured addresses and the
expected network before writes.

Copy `.env.example` to the ignored `.env.local`, then replace its documented
placeholders with the public addresses emitted by your local deployment. Never
put a wallet private key, mnemonic, Pinata JWT, or secret RPC credential in a
`VITE_*` variable. Re-export ABI modules after a contract build with:

```powershell
# From the repository root
node scripts/export-frontend-abis.mjs
```

See [SMART_CONTRACTS.md](./SMART_CONTRACTS.md) and
[../docs/LOCAL_DEPLOYMENT.md](../docs/LOCAL_DEPLOYMENT.md) for the address,
deployment, role, and ABI workflow.

## Pinata/IPFS proxy

The React app posts files and metadata only to `/api/ipfs/*`. Vite forwards these
requests to the local proxy, which reads its JWT server-side.

1. Copy `server/.env.example` to the ignored `server/.env`.
2. Add your own restricted `PINATA_JWT` to that local file.
3. Start the proxy in a separate terminal:

```powershell
npm.cmd run proxy
```

Never prefix the JWT with `VITE_`; doing so would expose it in the browser
bundle. Uploading metadata to IPFS is distinct from creating a campaign on the
blockchain and never triggers an Ethereum transaction by itself. Full setup and
deployment guidance is in [IPFS.md](./IPFS.md).
