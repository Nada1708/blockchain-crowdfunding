// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICrowdfunding} from "../interfaces/ICrowdfunding.sol";

/// @notice FAUX crowdfunding, pour les tests uniquement
contract MockCrowdfunding is ICrowdfunding {
    address public governance;
    mapping(uint256 => bool) public active;
    mapping(uint256 => address) public beneficiary;
    mapping(uint256 => bool) public frozen;
    mapping(uint256 => uint256) public released;

    function setGovernance(address g) external { governance = g; }

    function setCampaign(uint256 id, address b, bool a) external {
        beneficiary[id] = b;
        active[id] = a;
    }

    function isActive(uint256 id) external view returns (bool) { return active[id]; }
    function beneficiaryOf(uint256 id) external view returns (address) { return beneficiary[id]; }

    function freezeCampaign(uint256 id) external {
        require(msg.sender == governance, "only DAO");
        frozen[id] = true;
    }

    function approveEarlyRelease(uint256 id, uint256 amount) external {
        require(msg.sender == governance, "only DAO");
        released[id] = amount;
    }
}