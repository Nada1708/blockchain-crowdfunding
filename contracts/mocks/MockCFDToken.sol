// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @notice FAUX jeton, pour les tests uniquement (mint ouvert à tous)
contract MockCFDToken is ERC20, ERC20Permit, ERC20Votes {
    constructor() ERC20("Mock CFD", "mCFD") ERC20Permit("Mock CFD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Obligatoire : ERC20 et ERC20Votes définissent tous deux _update
    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public view override(ERC20Permit, Nonces) returns (uint256)
    {
        return super.nonces(owner);
    }
}