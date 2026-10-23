
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CFDToken is ERC20, Ownable {
    address public crowdfunding;

    event CrowdfundingUpdated(
        address indexed oldAddress,
        address indexed newAddress
    );

    constructor(address initialOwner)
        ERC20("Crowdfunding Token", "CFD")
        Ownable(initialOwner)
    {}

    modifier onlyCrowdfunding() {
        require(msg.sender == crowdfunding, "Only crowdfunding");
        _;
    }

    function setCrowdfunding(address newCrowdfunding) external onlyOwner {
        require(newCrowdfunding != address(0), "Zero address");

        address oldAddress = crowdfunding;
        crowdfunding = newCrowdfunding;

        emit CrowdfundingUpdated(oldAddress, newCrowdfunding);
    }

    function mint(address to, uint256 amount) external onlyCrowdfunding {
        _mint(to, amount);
    }
}

