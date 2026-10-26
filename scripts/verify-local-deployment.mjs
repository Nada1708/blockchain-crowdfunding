import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, getAddress } from "ethers";

const rpcUrl = process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const deploymentPath = resolve(
  "ignition",
  "deployments",
  "fundora-local",
  "deployed_addresses.json",
);

const deployed = JSON.parse(await readFile(deploymentPath, "utf8"));
const addresses = {
  CFDToken: deployed["FundoraModule#CFDToken"],
  Crowdfunding: deployed["FundoraModule#Crowdfunding"],
  CFDGovernance: deployed["FundoraModule#CFDGovernance"],
  MultiSigTreasury: deployed["FundoraModule#MultiSigTreasury"],
};

const artifact = async (name) =>
  JSON.parse(
    await readFile(
      resolve("artifacts", "contracts", `${name}.sol`, `${name}.json`),
      "utf8",
    ),
  );

const provider = new JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();

if (network.chainId !== 31337n) {
  throw new Error(`Expected Hardhat chain 31337, received ${network.chainId}`);
}

for (const [name, address] of Object.entries(addresses)) {
  if (!address || (await provider.getCode(address)) === "0x") {
    throw new Error(`${name} is not deployed at ${address ?? "<missing>"}`);
  }
}

const token = new Contract(
  addresses.CFDToken,
  (await artifact("CFDToken")).abi,
  provider,
);
const crowdfunding = new Contract(
  addresses.Crowdfunding,
  (await artifact("Crowdfunding")).abi,
  provider,
);
const governance = new Contract(
  addresses.CFDGovernance,
  (await artifact("CFDGovernance")).abi,
  provider,
);
const treasury = new Contract(
  addresses.MultiSigTreasury,
  (await artifact("MultiSigTreasury")).abi,
  provider,
);

const sameAddress = (left, right) => getAddress(left) === getAddress(right);
const minterRole = await token.MINTER_ROLE();
const burnerRole = await token.BURNER_ROLE();
const governanceRole = await crowdfunding.GOVERNANCE_ROLE();

const checks = {
  crowdfundingUsesToken: sameAddress(
    await crowdfunding.token(),
    addresses.CFDToken,
  ),
  governanceUsesToken: sameAddress(
    await governance.token(),
    addresses.CFDToken,
  ),
  governanceUsesCrowdfunding: sameAddress(
    await governance.crowdfunding(),
    addresses.Crowdfunding,
  ),
  crowdfundingHasMinterRole: await token.hasRole(
    minterRole,
    addresses.Crowdfunding,
  ),
  crowdfundingHasBurnerRole: await token.hasRole(
    burnerRole,
    addresses.Crowdfunding,
  ),
  governanceHasGovernanceRole: await crowdfunding.hasRole(
    governanceRole,
    addresses.CFDGovernance,
  ),
  treasuryRequiresTwoSignatures: (await treasury.REQUIRED()) === 2n,
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

console.log(JSON.stringify({ chainId: Number(network.chainId), addresses, checks }, null, 2));

if (failed.length > 0) {
  throw new Error(`Local deployment verification failed: ${failed.join(", ")}`);
}
