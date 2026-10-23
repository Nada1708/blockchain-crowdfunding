// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MultiSigTreasury} from "../MultiSigTreasury.sol";

/// @notice Contrat PIRATE, pour les tests uniquement
contract ReentrancyAttacker {
    MultiSigTreasury public treasury;
    uint256 public targetId;
    uint256 public attempts;
    bool public reentryBlocked;

    function setTarget(MultiSigTreasury t, uint256 id) external {
        treasury = t;
        targetId = id;
    }

    function attack() external {
        treasury.execute(targetId);
    }

    /// Appelée automatiquement quand le pirate reçoit des ETH
    receive() external payable {
        if (attempts == 0) {
            attempts++;
            // Tentative de se faire payer une 2e fois
            try treasury.execute(targetId) {
                // si on arrive ici, l'attaque a réussi
            } catch {
                reentryBlocked = true; // l'attaque a échoué ✅
            }
        }
    }
}