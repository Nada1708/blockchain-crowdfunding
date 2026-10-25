import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const ETH = (n: string) => ethers.parseEther(n);
const JOUR = 86400;

async function avancer(secondes: number) {
  await ethers.provider.send("evm_increaseTime", [secondes]);
  await ethers.provider.send("evm_mine", []);
}

describe("Crowdfunding + CFDToken", function () {
  let admin: any, dao: any, ben: any, alice: any, bob: any, mal: any;
  let token: any, cf: any;

  beforeEach(async function () {
    [admin, dao, ben, alice, bob, mal] = await ethers.getSigners();
    token = await ethers.deployContract("CFDToken", [admin.address]);
    cf = await ethers.deployContract("Crowdfunding", [
      await token.getAddress(),
      admin.address,
    ]);
    const cfAddr = await cf.getAddress();
    await token.grantRole(await token.MINTER_ROLE(), cfAddr);
    await token.grantRole(await token.BURNER_ROLE(), cfAddr);
    await cf.grantRole(await cf.GOVERNANCE_ROLE(), dao.address);

    // Campagne 1 : objectif 5 ETH, durée 7 jours
    await cf
      .connect(alice)
      .createCampaign(ben.address, ETH("5"), 7 * JOUR, "ipfs://cid1");
  });

  describe("création et contribution", function () {
    it("crée une campagne active avec le bon bénéficiaire", async function () {
      expect(await cf.isActive(1)).to.equal(true);
      expect(await cf.beneficiaryOf(1)).to.equal(ben.address);
    });

    it("refuse un objectif nul ou un bénéficiaire nul", async function () {
      await expect(
        cf.createCampaign(ben.address, 0, JOUR, "x"),
      ).to.be.revertedWithCustomError(cf, "InvalidParameters");
      await expect(
        cf.createCampaign(ethers.ZeroAddress, ETH("1"), JOUR, "x"),
      ).to.be.revertedWithCustomError(cf, "InvalidParameters");
    });

    it("refuse une contribution inférieure à 0,01 ETH", async function () {
      await expect(
        cf.connect(alice).contribute(1, { value: ETH("0.001") }),
      ).to.be.revertedWithCustomError(cf, "ContributionTooLow");
    });

    it("crée 1000 CFD par ETH et auto-délègue les voix", async function () {
      await expect(cf.connect(alice).contribute(1, { value: ETH("3") }))
        .to.emit(cf, "ContributionReceived")
        .withArgs(1, alice.address, ETH("3"), ETH("3000"));

      expect(await token.balanceOf(alice.address)).to.equal(ETH("3000"));
      expect(await token.delegates(alice.address)).to.equal(alice.address);
      expect(await token.getVotes(alice.address)).to.equal(ETH("3000"));
    });

    it("refuse de contribuer après la date limite", async function () {
      await avancer(8 * JOUR);
      expect(await cf.isActive(1)).to.equal(false);
      await expect(
        cf.connect(alice).contribute(1, { value: ETH("1") }),
      ).to.be.revertedWithCustomError(cf, "CampaignClosed");
    });
  });

  describe("droits d'accès", function () {
    it("seule la DAO peut geler, dégeler et autoriser", async function () {
      await expect(
        cf.connect(mal).freezeCampaign(1),
      ).to.be.revertedWithCustomError(cf, "AccessControlUnauthorizedAccount");
      await expect(
        cf.connect(mal).unfreezeCampaign(1),
      ).to.be.revertedWithCustomError(cf, "AccessControlUnauthorizedAccount");
      await expect(
        cf.connect(mal).approveEarlyRelease(1, ETH("1")),
      ).to.be.revertedWithCustomError(cf, "AccessControlUnauthorizedAccount");
    });

    it("personne d'autre que Crowdfunding ne peut mint ou burn", async function () {
      await expect(
        token.connect(mal).mint(mal.address, 1),
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await expect(
        token.connect(mal).burn(alice.address, 1),
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });

  describe("retrait par le bénéficiaire", function () {
    beforeEach(async function () {
      await cf.connect(alice).contribute(1, { value: ETH("3") });
      await cf.connect(bob).contribute(1, { value: ETH("3") });
    });

    it("refuse le retrait sans autorisation de la DAO", async function () {
      await expect(
        cf.connect(ben).withdrawFunds(1),
      ).to.be.revertedWithCustomError(cf, "NothingToWithdraw");
    });

    it("refuse une autorisation supérieure à ce qui a été levé", async function () {
      await expect(
        cf.connect(dao).approveEarlyRelease(1, ETH("7")),
      ).to.be.revertedWithCustomError(cf, "ExceedsRaised");
    });

    it("verse au bénéficiaire le montant autorisé, une seule fois", async function () {
      await cf.connect(dao).approveEarlyRelease(1, ETH("2"));

      await expect(
        cf.connect(mal).withdrawFunds(1),
      ).to.be.revertedWithCustomError(cf, "NotBeneficiary");

      const avant = await ethers.provider.getBalance(ben.address);
      const recu = await (await cf.connect(ben).withdrawFunds(1)).wait();
      const apres = await ethers.provider.getBalance(ben.address);
      expect(apres - avant + recu.fee).to.equal(ETH("2"));

      await expect(
        cf.connect(ben).withdrawFunds(1),
      ).to.be.revertedWithCustomError(cf, "NothingToWithdraw");
    });

    it("refuse le remboursement d'une campagne réussie non gelée", async function () {
      await expect(
        cf.connect(alice).refund(1),
      ).to.be.revertedWithCustomError(cf, "NotRefundable");
    });
  });

  describe("gel par la DAO", function () {
    beforeEach(async function () {
      await cf.connect(alice).contribute(1, { value: ETH("3") });
      await cf.connect(bob).contribute(1, { value: ETH("3") });
      await cf.connect(dao).approveEarlyRelease(1, ETH("2"));
      await cf.connect(ben).withdrawFunds(1);
      await cf.connect(dao).freezeCampaign(1);
    });

    it("désactive la campagne et bloque les contributions", async function () {
      expect(await cf.isActive(1)).to.equal(false);
      await expect(
        cf.connect(mal).contribute(1, { value: ETH("1") }),
      ).to.be.revertedWithCustomError(cf, "CampaignIsFrozen");
    });

    it("rembourse au prorata (3 ETH versés, 2 ETH rendus) et brûle les CFD", async function () {
      const avant = await ethers.provider.getBalance(alice.address);
      const recu = await (await cf.connect(alice).refund(1)).wait();
      const apres = await ethers.provider.getBalance(alice.address);

      expect(apres - avant + recu.fee).to.equal(ETH("2"));
      expect(await token.balanceOf(alice.address)).to.equal(0n);
      expect(await token.getVotes(alice.address)).to.equal(0n);
    });

    it("interdit le double remboursement", async function () {
      await cf.connect(alice).refund(1);
      await expect(
        cf.connect(alice).refund(1),
      ).to.be.revertedWithCustomError(cf, "NothingToRefund");
    });

    it("permet à la DAO de dégeler", async function () {
      await cf.connect(dao).unfreezeCampaign(1);
      await expect(
        cf.connect(dao).approveEarlyRelease(1, ETH("1")),
      ).to.emit(cf, "WithdrawalAuthorized");
    });
  });

  describe("campagne échouée", function () {
    beforeEach(async function () {
      await cf.connect(bob).contribute(1, { value: ETH("1") });
    });

    it("refuse le remboursement avant la date limite", async function () {
      await expect(
        cf.connect(bob).refund(1),
      ).to.be.revertedWithCustomError(cf, "NotRefundable");
    });

    it("rembourse 1 ETH et brûle 1000 CFD après la date limite", async function () {
      await avancer(8 * JOUR);

      const avant = await ethers.provider.getBalance(bob.address);
      const recu = await (await cf.connect(bob).refund(1)).wait();
      const apres = await ethers.provider.getBalance(bob.address);

      expect(apres - avant + recu.fee).to.equal(ETH("1"));
      expect(await token.balanceOf(bob.address)).to.equal(0n);
    });

    it("refuse le remboursement si les CFD ont été transférés ailleurs", async function () {
      await token.connect(bob).transfer(mal.address, ETH("1000"));
      await avancer(8 * JOUR);
      await expect(
        cf.connect(bob).refund(1),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("sécurité : réentrance", function () {
    it("bloque une attaque de réentrance sur refund()", async function () {
      const att = await ethers.deployContract("AttaqueRefund", [
        await cf.getAddress(),
      ]);
      await att.connect(mal).go(1, { value: ETH("1") });
      await cf.connect(bob).contribute(1, { value: ETH("2") });
      await avancer(8 * JOUR);

      const avant = await ethers.provider.getBalance(await cf.getAddress());
            await expect(att.connect(mal).boom()).to.be.revert(ethers);
      const apres = await ethers.provider.getBalance(await cf.getAddress());

      expect(apres).to.equal(avant);
    });
  });
});