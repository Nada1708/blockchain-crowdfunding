// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MultiSigTreasury} from "./MultiSigTreasury.sol";
import {ReentrancyAttacker} from "./mocks/ReentrancyAttacker.sol";

contract MultiSigTreasuryTest is Test {
    MultiSigTreasury ms;

    address alice    = makeAddr("alice");
    address bob      = makeAddr("bob");
    address carol    = makeAddr("carol");
    address dest     = makeAddr("dest");
    address outsider = makeAddr("outsider");

    function setUp() public {
        ms = new MultiSigTreasury([alice, bob, carol]);
        vm.deal(address(ms), 10 ether); // le coffre contient 10 ETH
    }

    // ═════ 1. RÈGLE 2-SUR-3 ═════

    function test_TwoOfThreeExecutes() public {
        vm.prank(alice); uint256 id = ms.submit(dest, 3 ether, ""); // 1/3
        vm.prank(bob);   ms.confirm(id);                            // 2/3
        vm.prank(alice); ms.execute(id);

        assertEq(dest.balance, 3 ether);
        assertEq(address(ms).balance, 7 ether);
    }

    function test_RevertWhen_OnlyOneSignature() public {
        vm.prank(alice); uint256 id = ms.submit(dest, 3 ether, "");

        vm.prank(alice);
        vm.expectRevert(MultiSigTreasury.NotEnoughConfirmations.selector);
        ms.execute(id);
    }

    function test_RevertWhen_SameSignerConfirmsTwice() public {
        vm.prank(alice); uint256 id = ms.submit(dest, 3 ether, "");

        vm.prank(alice);
        vm.expectRevert(MultiSigTreasury.AlreadyConfirmed.selector);
        ms.confirm(id);
    }

    function test_RevokeDropsBelowThreshold() public {
        vm.prank(alice); uint256 id = ms.submit(dest, 3 ether, "");
        vm.prank(bob);   ms.confirm(id);
        vm.prank(bob);   ms.revoke(id);   // Bob change d'avis : retour à 1/3

        vm.prank(alice);
        vm.expectRevert(MultiSigTreasury.NotEnoughConfirmations.selector);
        ms.execute(id);
    }

    // ═════ 2. ANTI-REJEU ═════

    function test_RevertWhen_ExecuteTwice() public {
        vm.prank(alice); uint256 id = ms.submit(dest, 3 ether, "");
        vm.prank(bob);   ms.confirm(id);
        vm.prank(alice); ms.execute(id);

        vm.prank(bob);
        vm.expectRevert(MultiSigTreasury.AlreadyExecuted.selector);
        ms.execute(id);
    }

    // ═════ 3. CONTRÔLE D'ACCÈS ═════

    function test_RevertWhen_DuplicateSigners() public {
        vm.expectRevert(MultiSigTreasury.InvalidSigners.selector);
        new MultiSigTreasury([alice, alice, bob]); // Alice aurait 2 clés sur 3
    }

    function test_RevertWhen_OutsiderExecutes() public {
        vm.prank(alice); uint256 id = ms.submit(dest, 3 ether, "");
        vm.prank(bob);   ms.confirm(id);

        vm.prank(outsider);
        vm.expectRevert(MultiSigTreasury.NotSigner.selector);
        ms.execute(id);
    }

    // ═════ 4. ATTAQUE REENTRANCY ═════

    function test_ReentrancyAttackBlocked() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker();
        // Pire cas : le pirate est l'un des 3 signataires
        MultiSigTreasury vault = new MultiSigTreasury([alice, bob, address(attacker)]);
        vm.deal(address(vault), 5 ether);

        // Retrait légitime de 1 ETH vers le pirate, approuvé 2/3
        vm.prank(alice); uint256 id = vault.submit(address(attacker), 1 ether, "");
        vm.prank(bob);   vault.confirm(id);

        attacker.setTarget(vault, id);
        attacker.attack();

        assertTrue(attacker.reentryBlocked());           // la 2e tentative a échoué
        assertEq(address(attacker).balance, 1 ether);     // 1 ETH, pas 2
        assertEq(address(vault).balance, 4 ether);        // le coffre n'est pas vidé
    }

    // ═════ 5. FUZZING ═════

    /// Pour N'IMPORTE QUELLE adresse non signataire : impossible de proposer
    function testFuzz_NonSignerCannotSubmit(address x) public {
        vm.assume(!ms.isSigner(x));
        vm.prank(x);
        vm.expectRevert(MultiSigTreasury.NotSigner.selector);
        ms.submit(dest, 1 ether, "");
    }
}