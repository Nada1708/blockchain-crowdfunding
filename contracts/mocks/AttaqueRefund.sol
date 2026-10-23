// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Crowdfunding} from "../Crowdfunding.sol";

/// @dev Contrat malveillant de test : tente de ré-entrer dans refund().
contract AttaqueRefund {
    Crowdfunding public cf;
    uint256 public id;
    uint256 public n;

    constructor(address c) {
        cf = Crowdfunding(c);
    }

    function go(uint256 _id) external payable {
        id = _id;
        cf.contribute{value: msg.value}(_id);
    }

    function boom() external {
        cf.refund(id);
    }

    receive() external payable {
        n++;
        if (n < 5) {
            cf.refund(id);
        }
    }
}