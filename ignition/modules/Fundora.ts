import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("FundoraModule", (m) => {
  const admin = m.getAccount(0);
  const secondSigner = m.getAccount(1);
  const thirdSigner = m.getAccount(2);

  // The multisig is deployed for the future administration flow. The local
  // deployer remains the bootstrap admin so it can wire the required roles.
  const multiSigTreasury = m.contract("MultiSigTreasury", [
    [admin, secondSigner, thirdSigner],
  ]);

  const cfdToken = m.contract("CFDToken", [admin]);
  const crowdfunding = m.contract("Crowdfunding", [cfdToken, admin]);
  const cfdGovernance = m.contract("CFDGovernance", [
    cfdToken,
    crowdfunding,
    admin,
  ]);

  const minterRole = m.staticCall(cfdToken, "MINTER_ROLE", [], 0, {
    id: "ReadMinterRole",
  });
  const burnerRole = m.staticCall(cfdToken, "BURNER_ROLE", [], 0, {
    id: "ReadBurnerRole",
  });
  const governanceRole = m.staticCall(
    crowdfunding,
    "GOVERNANCE_ROLE",
    [],
    0,
    { id: "ReadGovernanceRole" },
  );

  m.call(cfdToken, "grantRole", [minterRole, crowdfunding], {
    id: "GrantCrowdfundingMinterRole",
    from: admin,
  });
  m.call(cfdToken, "grantRole", [burnerRole, crowdfunding], {
    id: "GrantCrowdfundingBurnerRole",
    from: admin,
  });
  m.call(crowdfunding, "grantRole", [governanceRole, cfdGovernance], {
    id: "GrantDaoGovernanceRole",
    from: admin,
  });

  return { cfdToken, crowdfunding, cfdGovernance, multiSigTreasury };
});
