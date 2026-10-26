import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const contracts = [
  ["CFDToken", "cfdTokenAbi"],
  ["Crowdfunding", "crowdfundingAbi"],
  ["CFDGovernance", "cfdGovernanceAbi"],
];

for (const [contractName, exportName] of contracts) {
  const artifactPath = resolve(
    "artifacts",
    "contracts",
    `${contractName}.sol`,
    `${contractName}.json`,
  );
  const targetPath = resolve("frontend", "src", "abi", `${contractName}.ts`);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));

  if (!Array.isArray(artifact.abi)) {
    throw new Error(`No generated ABI found in ${artifactPath}`);
  }

  const source = [
    "import type { InterfaceAbi } from 'ethers'",
    "",
    "// Generated from the Hardhat artifact. Do not edit this ABI manually.",
    `export const ${exportName}: InterfaceAbi = ${JSON.stringify(artifact.abi, null, 2)}`,
    "",
  ].join("\n");

  await writeFile(targetPath, source, "utf8");
  console.log(`Exported ${contractName} ABI to ${targetPath}`);
}
