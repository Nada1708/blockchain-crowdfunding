# Fundora local deployment

The local deployment targets Hardhat chain `31337` at
`http://127.0.0.1:8545`. It never uses Sepolia credentials.

## Start or restore the local environment

From the repository root, keep the node running in a first terminal:

```powershell
npx.cmd hardhat node --hostname 127.0.0.1 --port 8545
```

In a second terminal, deploy the contracts and assign the application roles:

```powershell
npx.cmd hardhat ignition deploy ignition/modules/Fundora.ts --network localhost --deployment-id fundora-local
```

Ignition uses account 0 only for bootstrap wiring. It preserves the
Crowdfunding minter/burner and CFDGovernance governance roles, grants the
admin/pauser roles to MultiSigTreasury, validates the complete sequence, and
then revokes account 0's bootstrap privileges. Administrative actions must
thereafter be submitted to the multisig and confirmed by two of its first three
Hardhat signers.

The node stores its state only while its process is running. After restarting a
fresh node, reset the matching local Ignition journal before redeploying:

```powershell
npx.cmd hardhat ignition deploy ignition/modules/Fundora.ts --network localhost --deployment-id fundora-local --reset
```

Verify the deployed Freeze/Unfreeze bytecode, contract links, operational
roles, multisig admin/pauser ownership, bootstrap revocation, chain ID, and
multisig threshold:

```powershell
node scripts/verify-local-deployment.mjs
```

Regenerate the frontend ABI modules exclusively from the compiled Hardhat
artifacts:

```powershell
node scripts/export-frontend-abis.mjs
```

## Frontend addresses

The three public local contract addresses are stored in the ignored file
`frontend/.env.local`. Vite loads them through the existing
`VITE_HARDHAT_*_ADDRESS` variables. Copy the documented placeholders from
`frontend/.env.example` when setting up another workstation, then replace them
with the addresses emitted by that workstation's local deployment.

No private key, wallet mnemonic, Pinata token, or Sepolia credential belongs in
either file.
