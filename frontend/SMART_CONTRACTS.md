# Frontend contract integration

The frontend supports Hardhat Local (`31337`) and Sepolia (`11155111`). Contract
addresses are read from the `VITE_*` variables listed in `.env.example`. Copy that
file to `.env.local`, replace every placeholder with the corresponding deployment
address, and restart Vite. These addresses are public configuration; private keys
and RPC secrets must never be added to a Vite environment variable.

## Updating ABIs after a Hardhat deployment

1. Compile the contracts from the repository root with `npx hardhat compile`.
2. Locate each generated artifact under `artifacts/contracts/.../<Contract>.json`.
3. Copy only its `abi` value into the matching file in `src/abi/` and export it as
   an Ethers `InterfaceAbi`. Do not copy bytecode or invent missing entries.
4. Add the deployed addresses to `.env.local` for the deployment network.
5. Run `npm.cmd run lint` and `npm.cmd run build` from `frontend/`.

This repository includes ABI modules generated from the real `CFDToken`,
`Crowdfunding`, and `CFDGovernance` Hardhat artifacts. The helper script
`../scripts/export-frontend-abis.mjs` refreshes those modules after compilation;
the generated ABI must not be edited by inventing functions. Contract factory
helpers still report a configuration error when the address for the selected
network is absent or invalid.
