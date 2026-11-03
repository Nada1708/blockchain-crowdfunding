import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, getAddress, id } from "ethers";

const rpcUrl = process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const expectedChainId = BigInt(process.env.LOCAL_CHAIN_ID ?? "31337");
const deploymentId = process.env.LOCAL_DEPLOYMENT_ID ?? "fundora-local";
const deploymentPath = resolve(
  "ignition",
  "deployments",
  deploymentId,
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

if (network.chainId !== expectedChainId) {
  throw new Error(`Expected Hardhat chain ${expectedChainId}, received ${network.chainId}`);
}

const runtimeCode = {};
for (const [name, address] of Object.entries(addresses)) {
  const code = address ? await provider.getCode(address) : "0x";
  if (!address || code === "0x") {
    throw new Error(`${name} is not deployed at ${address ?? "<missing>"}`);
  }
  runtimeCode[name] = code.toLowerCase();
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
const localAccounts = await provider.send("eth_accounts", []);
if (localAccounts.length < 3) throw new Error("The local node must expose at least three test accounts.");
const minterRole = await token.MINTER_ROLE();
const burnerRole = await token.BURNER_ROLE();
const governanceRole = await crowdfunding.GOVERNANCE_ROLE();
const defaultAdminRole = await token.DEFAULT_ADMIN_ROLE();
const crowdfundingPauserRole = await crowdfunding.PAUSER_ROLE();
const governancePauserRole = await governance.PAUSER_ROLE();

const checks = {
  crowdfundingSupportsIsFrozen:
    runtimeCode.Crowdfunding.includes(id("isFrozen(uint256)").slice(2, 10)),
  governanceSupportsUnfreeze:
    runtimeCode.CFDGovernance.includes(id("CampaignNotFrozen()").slice(2, 10)),
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
  deployerAdministersToken: await token.hasRole(defaultAdminRole, localAccounts[0]),
  deployerAdministersCrowdfunding: await crowdfunding.hasRole(defaultAdminRole, localAccounts[0]),
  deployerPausesCrowdfunding: await crowdfunding.hasRole(crowdfundingPauserRole, localAccounts[0]),
  deployerAdministersGovernance: await governance.hasRole(defaultAdminRole, localAccounts[0]),
  deployerPausesGovernance: await governance.hasRole(governancePauserRole, localAccounts[0]),
  treasuryRequiresTwoSignatures: (await treasury.REQUIRED()) === 2n,
  treasuryUsesFirstThreeAccounts: (
    await Promise.all([0n, 1n, 2n].map((index) => treasury.signers(index)))
  ).every((signer, index) => sameAddress(signer, localAccounts[index])),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

console.log(JSON.stringify({ chainId: Number(network.chainId), deploymentId, addresses, checks }, null, 2));

if (failed.length > 0) {
  throw new Error(`Local deployment verification failed: ${failed.join(", ")}`);
}
