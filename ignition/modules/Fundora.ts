import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("FundoraModule", (m) => {
  const admin = m.getAccount(0);
  const secondSigner = m.getAccount(1);
  const thirdSigner = m.getAccount(2);

  // The deployer is a bootstrap administrator only. Ignition wires the
  // operational roles, hands administration to the 2-of-3 multisig, then
  // removes every bootstrap privilege before completing the deployment.
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
  const tokenAdminRole = m.staticCall(cfdToken, "DEFAULT_ADMIN_ROLE", [], 0, {
    id: "ReadTokenAdminRole",
  });
  const crowdfundingAdminRole = m.staticCall(
    crowdfunding,
    "DEFAULT_ADMIN_ROLE",
    [],
    0,
    { id: "ReadCrowdfundingAdminRole" },
  );
  const crowdfundingPauserRole = m.staticCall(
    crowdfunding,
    "PAUSER_ROLE",
    [],
    0,
    { id: "ReadCrowdfundingPauserRole" },
  );
  const governanceAdminRole = m.staticCall(
    cfdGovernance,
    "DEFAULT_ADMIN_ROLE",
    [],
    0,
    { id: "ReadGovernanceAdminRole" },
  );
  const governancePauserRole = m.staticCall(
    cfdGovernance,
    "PAUSER_ROLE",
    [],
    0,
    { id: "ReadGovernancePauserRole" },
  );

  const grantMinter = m.call(cfdToken, "grantRole", [minterRole, crowdfunding], {
    id: "GrantCrowdfundingMinterRole",
    from: admin,
  });
  const grantBurner = m.call(cfdToken, "grantRole", [burnerRole, crowdfunding], {
    id: "GrantCrowdfundingBurnerRole",
    from: admin,
  });
  const grantGovernance = m.call(crowdfunding, "grantRole", [governanceRole, cfdGovernance], {
    id: "GrantDaoGovernanceRole",
    from: admin,
  });

  const grantTokenAdmin = m.call(
    cfdToken,
    "grantRole",
    [tokenAdminRole, multiSigTreasury],
    { id: "GrantMultisigTokenAdmin", from: admin },
  );
  const grantCrowdfundingAdmin = m.call(
    crowdfunding,
    "grantRole",
    [crowdfundingAdminRole, multiSigTreasury],
    { id: "GrantMultisigCrowdfundingAdmin", from: admin },
  );
  const grantCrowdfundingPauser = m.call(
    crowdfunding,
    "grantRole",
    [crowdfundingPauserRole, multiSigTreasury],
    { id: "GrantMultisigCrowdfundingPauser", from: admin },
  );
  const grantGovernanceAdmin = m.call(
    cfdGovernance,
    "grantRole",
    [governanceAdminRole, multiSigTreasury],
    { id: "GrantMultisigGovernanceAdmin", from: admin },
  );
  const grantGovernancePauser = m.call(
    cfdGovernance,
    "grantRole",
    [governancePauserRole, multiSigTreasury],
    { id: "GrantMultisigGovernancePauser", from: admin },
  );

  const handoffReady = [
    grantMinter,
    grantBurner,
    grantGovernance,
    grantTokenAdmin,
    grantCrowdfundingAdmin,
    grantCrowdfundingPauser,
    grantGovernanceAdmin,
    grantGovernancePauser,
  ];

  m.call(cfdToken, "revokeRole", [tokenAdminRole, admin], {
    id: "RevokeBootstrapTokenAdmin",
    from: admin,
    after: handoffReady,
  });
  const revokeCrowdfundingPauser = m.call(crowdfunding, "revokeRole", [crowdfundingPauserRole, admin], {
    id: "RevokeBootstrapCrowdfundingPauser",
    from: admin,
    after: handoffReady,
  });
  m.call(crowdfunding, "revokeRole", [crowdfundingAdminRole, admin], {
    id: "RevokeBootstrapCrowdfundingAdmin",
    from: admin,
    after: [...handoffReady, revokeCrowdfundingPauser],
  });
  const revokeGovernancePauser = m.call(cfdGovernance, "revokeRole", [governancePauserRole, admin], {
    id: "RevokeBootstrapGovernancePauser",
    from: admin,
    after: handoffReady,
  });
  m.call(cfdGovernance, "revokeRole", [governanceAdminRole, admin], {
    id: "RevokeBootstrapGovernanceAdmin",
    from: admin,
    after: [...handoffReady, revokeGovernancePauser],
  });

  return { cfdToken, crowdfunding, cfdGovernance, multiSigTreasury };
});
