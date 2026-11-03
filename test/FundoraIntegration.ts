import { expect } from "chai";
import { network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";

const { ethers } = await network.create();

const ETH = (value: string) => ethers.parseEther(value);
const DAY = 24 * 60 * 60;

describe("Fundora real-contract integration", function () {
  it("wires roles and supports campaign, contribution, mint, proposal and vote", async function () {
    const [admin, beneficiary, creator, contributor, outsider] =
      await ethers.getSigners();

    const token = await ethers.deployContract("CFDToken", [admin.address]);
    const crowdfunding = await ethers.deployContract("Crowdfunding", [
      await token.getAddress(),
      admin.address,
    ]);
    const governance = await ethers.deployContract("CFDGovernance", [
      await token.getAddress(),
      await crowdfunding.getAddress(),
      admin.address,
    ]);

    const crowdfundingAddress = await crowdfunding.getAddress();
    const governanceAddress = await governance.getAddress();
    const minterRole = await token.MINTER_ROLE();
    const burnerRole = await token.BURNER_ROLE();
    const governanceRole = await crowdfunding.GOVERNANCE_ROLE();

    await token.grantRole(minterRole, crowdfundingAddress);
    await token.grantRole(burnerRole, crowdfundingAddress);
    await crowdfunding.grantRole(governanceRole, governanceAddress);

    expect(await token.hasRole(minterRole, crowdfundingAddress)).to.equal(true);
    expect(await token.hasRole(burnerRole, crowdfundingAddress)).to.equal(true);
    expect(
      await crowdfunding.hasRole(governanceRole, governanceAddress),
    ).to.equal(true);

    await expect(token.connect(outsider).mint(outsider.address, 1n))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(crowdfunding.connect(outsider).freezeCampaign(1n))
      .to.be.revertedWithCustomError(
        crowdfunding,
        "AccessControlUnauthorizedAccount",
      );

    const metadataUri = "ipfs://fundora-integration-test";
    await expect(
      crowdfunding
        .connect(creator)
        .createCampaign(beneficiary.address, ETH("5"), 7 * DAY, metadataUri),
    )
      .to.emit(crowdfunding, "CampaignCreated")
      .withArgs(1n, beneficiary.address, ETH("5"), anyValue, metadataUri);

    await expect(
      crowdfunding.connect(contributor).contribute(1n, { value: ETH("1") }),
    )
      .to.emit(crowdfunding, "ContributionReceived")
      .withArgs(1n, contributor.address, ETH("1"), ETH("1000"));

    expect(await token.balanceOf(contributor.address)).to.equal(ETH("1000"));
    expect(await token.getVotes(contributor.address)).to.equal(ETH("1000"));

    await expect(
      governance.connect(contributor).propose(0, 1n, 0n),
    ).to.emit(governance, "ProposalCreated");

    await expect(governance.connect(contributor).castVote(1n, true))
      .to.emit(governance, "VoteCast")
      .withArgs(1n, contributor.address, true, ETH("1000"));

    expect(await governance.hasVoted(1n, contributor.address)).to.equal(true);
    const proposal = await governance.proposals(1n);
    expect(proposal.forVotes).to.equal(ETH("1000"));
    expect(await governance.state(1n)).to.equal(0n);
  });

  it("freezes and unfreezes through separate 48-hour DAO votes", async function () {
    const [admin, beneficiary, contributor] = await ethers.getSigners();
    const token = await ethers.deployContract("CFDToken", [admin.address]);
    const crowdfunding = await ethers.deployContract("Crowdfunding", [
      await token.getAddress(), admin.address,
    ]);
    const governance = await ethers.deployContract("CFDGovernance", [
      await token.getAddress(), await crowdfunding.getAddress(), admin.address,
    ]);

    await token.grantRole(await token.MINTER_ROLE(), await crowdfunding.getAddress());
    await crowdfunding.grantRole(await crowdfunding.GOVERNANCE_ROLE(), await governance.getAddress());
    await crowdfunding.createCampaign(beneficiary.address, ETH("1"), 30 * DAY, "ipfs://unfreeze-test");
    await crowdfunding.connect(contributor).contribute(1n, { value: ETH("0.1") });

    await governance.connect(contributor).propose(0, 1n, 0n);
    await governance.connect(contributor).castVote(1n, true);
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governance.execute(1n);
    expect((await crowdfunding.getCampaign(1n)).frozen).to.equal(true);

    await governance.connect(contributor).propose(2, 1n, 0n);
    await governance.connect(contributor).castVote(2n, true);
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governance.execute(2n);
    expect((await crowdfunding.getCampaign(1n)).frozen).to.equal(false);
  });

  it("hands administration to the 2-of-3 multisig without an admin lock", async function () {
    const [bootstrap, secondSigner, thirdSigner, outsider] =
      await ethers.getSigners();
    const multisig = await ethers.deployContract("MultiSigTreasury", [[
      bootstrap.address,
      secondSigner.address,
      thirdSigner.address,
    ]]);
    const token = await ethers.deployContract("CFDToken", [bootstrap.address]);
    const crowdfunding = await ethers.deployContract("Crowdfunding", [
      await token.getAddress(),
      bootstrap.address,
    ]);
    const governance = await ethers.deployContract("CFDGovernance", [
      await token.getAddress(),
      await crowdfunding.getAddress(),
      bootstrap.address,
    ]);

    const multisigAddress = await multisig.getAddress();
    const adminRole = await token.DEFAULT_ADMIN_ROLE();
    const crowdfundingPauserRole = await crowdfunding.PAUSER_ROLE();
    const governancePauserRole = await governance.PAUSER_ROLE();

    await token.grantRole(await token.MINTER_ROLE(), await crowdfunding.getAddress());
    await token.grantRole(await token.BURNER_ROLE(), await crowdfunding.getAddress());
    await crowdfunding.grantRole(
      await crowdfunding.GOVERNANCE_ROLE(),
      await governance.getAddress(),
    );
    await token.grantRole(adminRole, multisigAddress);
    await crowdfunding.grantRole(adminRole, multisigAddress);
    await crowdfunding.grantRole(crowdfundingPauserRole, multisigAddress);
    await governance.grantRole(adminRole, multisigAddress);
    await governance.grantRole(governancePauserRole, multisigAddress);

    await token.revokeRole(adminRole, bootstrap.address);
    await crowdfunding.revokeRole(crowdfundingPauserRole, bootstrap.address);
    await crowdfunding.revokeRole(adminRole, bootstrap.address);
    await governance.revokeRole(governancePauserRole, bootstrap.address);
    await governance.revokeRole(adminRole, bootstrap.address);

    expect(await token.hasRole(adminRole, multisigAddress)).to.equal(true);
    expect(await crowdfunding.hasRole(adminRole, multisigAddress)).to.equal(true);
    expect(await governance.hasRole(adminRole, multisigAddress)).to.equal(true);
    expect(
      await token.hasRole(await token.MINTER_ROLE(), await crowdfunding.getAddress()),
    ).to.equal(true);
    expect(
      await token.hasRole(await token.BURNER_ROLE(), await crowdfunding.getAddress()),
    ).to.equal(true);
    expect(
      await crowdfunding.hasRole(
        await crowdfunding.GOVERNANCE_ROLE(),
        await governance.getAddress(),
      ),
    ).to.equal(true);
    expect(await token.hasRole(adminRole, bootstrap.address)).to.equal(false);
    expect(await crowdfunding.hasRole(crowdfundingPauserRole, bootstrap.address)).to.equal(false);
    expect(await governance.hasRole(governancePauserRole, bootstrap.address)).to.equal(false);

    const pauseCrowdfunding = crowdfunding.interface.encodeFunctionData("pause");
    await multisig.connect(bootstrap).submit(await crowdfunding.getAddress(), 0n, pauseCrowdfunding);

    await expect(multisig.connect(bootstrap).execute(0n))
      .to.be.revertedWithCustomError(multisig, "NotEnoughConfirmations");
    await expect(multisig.connect(outsider).confirm(0n))
      .to.be.revertedWithCustomError(multisig, "NotSigner");

    await multisig.connect(secondSigner).confirm(0n);
    await multisig.connect(thirdSigner).execute(0n);
    expect(await crowdfunding.paused()).to.equal(true);

    await expect(crowdfunding.connect(bootstrap).unpause())
      .to.be.revertedWithCustomError(crowdfunding, "AccessControlUnauthorizedAccount");
    await expect(token.connect(bootstrap).grantRole(await token.MINTER_ROLE(), outsider.address))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

    const unpauseCrowdfunding = crowdfunding.interface.encodeFunctionData("unpause");
    await multisig.connect(bootstrap).submit(await crowdfunding.getAddress(), 0n, unpauseCrowdfunding);
    await multisig.connect(secondSigner).confirm(1n);
    await multisig.connect(secondSigner).execute(1n);
    expect(await crowdfunding.paused()).to.equal(false);

    const pauseGovernance = governance.interface.encodeFunctionData("pause");
    await multisig.connect(bootstrap).submit(await governance.getAddress(), 0n, pauseGovernance);
    await multisig.connect(thirdSigner).confirm(2n);
    await multisig.connect(bootstrap).execute(2n);
    expect(await governance.paused()).to.equal(true);

    await expect(governance.connect(bootstrap).unpause())
      .to.be.revertedWithCustomError(governance, "AccessControlUnauthorizedAccount");
    const unpauseGovernance = governance.interface.encodeFunctionData("unpause");
    await multisig.connect(bootstrap).submit(await governance.getAddress(), 0n, unpauseGovernance);
    await multisig.connect(secondSigner).confirm(3n);
    await multisig.connect(thirdSigner).execute(3n);
    expect(await governance.paused()).to.equal(false);

    const grantMinter = token.interface.encodeFunctionData("grantRole", [
      await token.MINTER_ROLE(),
      outsider.address,
    ]);
    await multisig.connect(bootstrap).submit(await token.getAddress(), 0n, grantMinter);
    await multisig.connect(secondSigner).confirm(4n);
    await multisig.connect(thirdSigner).execute(4n);
    expect(await token.hasRole(await token.MINTER_ROLE(), outsider.address)).to.equal(true);
  });
});
