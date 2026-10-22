// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {IERC6372} from "@openzeppelin/contracts/interfaces/IERC6372.sol";

/// @notice Ce que la DAO attend du jeton CFD (ERC20Votes)
interface ICFDVotes is IVotes, IERC6372 {}