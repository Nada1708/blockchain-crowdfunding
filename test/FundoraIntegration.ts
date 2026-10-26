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
});
