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

At present, this repository contains only the generated `Counter` artifact. The
ABIs for `CFDToken`, `Crowdfunding`, and `CFDGovernance` therefore remain explicitly
unset. Contract factory helpers will report a configuration error until the real
artifacts and addresses are supplied.
