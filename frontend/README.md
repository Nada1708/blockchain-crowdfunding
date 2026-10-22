# Fundora frontend

React, TypeScript and Vite frontend for Fundora. This version includes the public
pages, responsive navigation, English/French translations, Light/Dark themes,
MetaMask connection state, DEMO campaign/governance data, and the optional Pinata
upload flow. It does not submit campaign or governance transactions to Ethereum.

## Local setup

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

The application is served at `http://localhost:5173` by default.

Useful validation commands:

```bash
npm run lint
npm run build
```

## Environment configuration

- `.env.example` documents the public contract address variables for Hardhat Local
  and Sepolia. Contract ABIs are not available yet, so no contract operation is
  connected in this frontend version. See [SMART_CONTRACTS.md](./SMART_CONTRACTS.md).
- `server/.env.example` documents the server-only Pinata proxy variables. Copy it
  to `server/.env`, provide your own restricted `PINATA_JWT`, then run the proxy in
  a separate terminal:

```bash
npm run proxy
```

Never prefix the Pinata JWT with `VITE_`. Local `.env` files are ignored by Git;
only `.env.example` templates belong in the repository. Full proxy and deployment
guidance is available in [IPFS.md](./IPFS.md).

## Available routes

- `/` — landing page and DEMO featured campaigns
- `/campaigns` — searchable and filterable DEMO campaign catalogue
- `/create` — validated campaign preview and optional IPFS upload
- `/governance` — DEMO DAO dashboard with disabled on-chain actions

MetaMask access is requested only after clicking **Connect Wallet**. Fundora warns
when the active network is not Sepolia and only provides a local session reset; it
does not claim to disconnect the MetaMask extension.
