# Pinata/IPFS local setup

Fundora sends uploads to a small local proxy. The React bundle never receives the
Pinata credential: `PINATA_JWT` is read only by the Node process and must never use
the `VITE_` prefix.

1. Create a restricted JWT in the Pinata dashboard with only the permissions needed
   to upload public files.
2. Copy `server/.env.example` to `server/.env` and replace the placeholder.
3. In a first terminal, run `npm.cmd run proxy` from `frontend/`.
4. In a second terminal, run `npm.cmd run dev`. Vite forwards `/api/ipfs/*` to the
   local proxy at `127.0.0.1:8787`.

For deployment, expose the same two server routes behind your application domain,
store `PINATA_JWT` in the hosting provider's server-side secret manager, configure
`IPFS_PROXY_ALLOWED_ORIGINS`, add authentication/rate limiting appropriate to the
deployment, and never commit `server/.env`.

The proxy uses Pinata's current v3 public file upload endpoint. It uploads the
optional image first, then uploads a JSON file containing `title`, `description`,
and `imageCid`. A successful IPFS upload does not create a campaign or trigger any
Ethereum transaction.
