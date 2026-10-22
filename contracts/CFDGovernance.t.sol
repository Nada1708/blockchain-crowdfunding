// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CFDGovernance} from "./CFDGovernance.sol";
import {ICFDVotes} from "./interfaces/ICFDVotes.sol";
import {MockCFDToken} from "./mocks/MockCFDToken.sol";
import {MockCrowdfunding} from "./mocks/MockCrowdfunding.sol";

contract CFDGovernanceTest is Test {
    MockCFDToken token;
    MockCrowdfunding cf;
    CFDGovernance dao;

    address ali      = address(0xA11);   // 3000 CFD
    address karim    = address(0xB0B);   // 1000 CFD
    address dina     = address(0xD1A);   // 100 CFD
    address sara     = address(0x5A4A);  // bénéficiaire de la campagne 1
    address sam      = address(0x5A11);  // 0 CFD au départ
    address attacker = address(0xBAD);   // 0 CFD

    // ───── Mise en place, avant CHAQUE test ─────
    function setUp() public {
        token = new MockCFDToken();
        cf = new MockCrowdfunding();
        dao = new CFDGovernance(ICFDVotes(address(token)), cf);

        cf.setGovernance(address(dao));
        cf.setCampaign(1, sara, true);

        token.mint(ali, 3000e18);
        token.mint(karim, 1000e18);
        token.mint(dina, 100e18);

        // Sans délégation, le pouvoir de vote vaut 0
        vm.prank(ali);   token.delegate(ali);
        vm.prank(karim); token.delegate(karim);
        vm.prank(dina);  token.delegate(dina);

        vm.roll(block.number + 1); // on avance d'un bloc : les soldes sont dans le passé
    }

    function _proposeFreeze() internal returns (uint256) {
        vm.prank(ali);
        return dao.propose(CFDGovernance.ProposalType.Freeze, 1, 0);
    }

    function _forVotes(uint256 id) internal view returns (uint256 f) {
        (, , , , , , f, , ) = dao.proposals(id);
    }

    // ═════ 1. SCÉNARIO NORMAL ═════

    function test_FreezeAdoptedAndExecuted() public {
        uint256 id = _proposeFreeze();
        vm.prank(ali);   dao.castVote(id, true);   // 3000 OUI
        vm.prank(karim); dao.castVote(id, false);  // 1000 NON

        vm.warp(block.timestamp + 48 hours);       // fin du vote
        assertEq(uint256(dao.state(id)), uint256(CFDGovernance.ProposalState.Succeeded));

        dao.execute(id);
        assertTrue(cf.frozen(1));
    }

    function test_EarlyReleaseByBeneficiary() public {
        vm.prank(sara);
        uint256 id = dao.propose(CFDGovernance.ProposalType.EarlyRelease, 1, 2e18);
        vm.prank(ali); dao.castVote(id, true);

        vm.warp(block.timestamp + 48 hours);
        dao.execute(id);
        assertEq(cf.released(1), 2e18);
    }

    // ═════ 2. ATTAQUES SUR LE VOTE ═════

    /// Vote éclair : jetons obtenus APRÈS la photo = 0 voix
    function test_SnapshotBlocksFlashVote() public {
        uint256 id = _proposeFreeze();

        token.mint(attacker, 1_000_000e18);
        vm.prank(attacker); token.delegate(attacker);
        vm.roll(block.number + 1);

        vm.prank(attacker);
        vm.expectRevert(CFDGovernance.NoVotingPower.selector);
        dao.castVote(id, true);
    }

    /// Ali transfère 300 CFD pendant le vote : il garde 3000 voix, Sam en a 0
    function test_TransferAfterSnapshotDoesNotDoubleVote() public {
        uint256 id = _proposeFreeze();

        vm.prank(ali); token.transfer(sam, 300e18);
        vm.prank(sam); token.delegate(sam);
        vm.roll(block.number + 1);

        vm.prank(ali); dao.castVote(id, true);
        assertEq(_forVotes(id), 3000e18);

        vm.prank(sam);
        vm.expectRevert(CFDGovernance.NoVotingPower.selector);
        dao.castVote(id, true);
    }

    function test_RevertWhen_DoubleVote() public {
        uint256 id = _proposeFreeze();
        vm.prank(ali); dao.castVote(id, true);

        vm.prank(ali);
        vm.expectRevert(CFDGovernance.AlreadyVoted.selector);
        dao.castVote(id, true);
    }

    function test_RevertWhen_VoteAfterDeadline() public {
        uint256 id = _proposeFreeze();
        vm.warp(block.timestamp + 48 hours);

        vm.prank(ali);
        vm.expectRevert(CFDGovernance.VotingClosed.selector);
        dao.castVote(id, true);
    }

    // ═════ 3. RÈGLES DE VALIDATION ═════

    /// Seule Dina vote (100 voix) < quorum (20 % de 4100 = 820) : rejet
    function test_DefeatedWhenQuorumNotReached() public {
        uint256 id = _proposeFreeze();
        vm.prank(dina); dao.castVote(id, true);

        vm.warp(block.timestamp + 48 hours);
        assertEq(uint256(dao.state(id)), uint256(CFDGovernance.ProposalState.Defeated));

        vm.expectRevert(CFDGovernance.NotSucceeded.selector);
        dao.execute(id);
    }

    function test_RevertWhen_ExecuteTwice() public {
        uint256 id = _proposeFreeze();
        vm.prank(ali); dao.castVote(id, true);
        vm.warp(block.timestamp + 48 hours);
        dao.execute(id);

        vm.expectRevert(CFDGovernance.NotSucceeded.selector);
        dao.execute(id);
    }

    // ═════ 4. CONTRÔLE D'ACCÈS ═════

    function test_RevertWhen_NonBeneficiaryAsksRelease() public {
        vm.prank(attacker);
        vm.expectRevert(CFDGovernance.NotBeneficiary.selector);
        dao.propose(CFDGovernance.ProposalType.EarlyRelease, 1, 2e18);
    }

    function test_RevertWhen_FreezeProposerBelowThreshold() public {
        vm.prank(attacker);
        vm.expectRevert(CFDGovernance.BelowProposalThreshold.selector);
        dao.propose(CFDGovernance.ProposalType.Freeze, 1, 0);
    }

    // ═════ 5. FUZZING ═════

    /// Pour N'IMPORTE QUELS montants : le poids du vote = le solde SUR LA PHOTO,
    /// même si le votant reçoit des jetons supplémentaires après.
    function testFuzz_VoteWeightEqualsSnapshotBalance(uint256 amount, uint256 extra) public {
        amount = bound(amount, 1, 1e30);
        extra  = bound(extra, 0, 1e30);
        address voter = address(0xF00D);

        token.mint(voter, amount);
        vm.prank(voter); token.delegate(voter);
        vm.roll(block.number + 1);

        uint256 id = _proposeFreeze();

        token.mint(voter, extra);          // jetons reçus APRÈS la photo
        vm.roll(block.number + 1);

        vm.prank(voter); dao.castVote(id, true);
        assertEq(_forVotes(id), amount);   // seul le solde de la photo compte
    }
}
