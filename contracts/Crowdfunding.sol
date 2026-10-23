// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICrowdfunding} from "./interfaces/ICrowdfunding.sol";
import {CFDToken} from "./CFDToken.sol";

/// @title Plateforme de financement participatif
/// @notice Les contributeurs reçoivent des CFD (voix de gouvernance). La DAO
///         peut geler une campagne et autoriser des retraits au bénéficiaire.
contract Crowdfunding is ICrowdfunding, AccessControl, ReentrancyGuard {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public constant RATE = 1000;                 // 1 ETH = 1000 CFD
    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;
    uint256 public constant MAX_DURATION = 365 days;

    struct Campaign {
        address beneficiary;
        uint64 deadline;
        bool frozen;
        uint256 goal;
        uint256 raised;      // total reçu (wei)
        uint256 approved;    // total autorisé par la DAO (cumulatif)
        uint256 withdrawn;   // total déjà retiré par le bénéficiaire
        string cid;          // métadonnées IPFS
    }

    CFDToken public immutable token;
    uint256 public campaignCount;
    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    event CampaignCreated(uint256 indexed id, address indexed beneficiary, uint256 goal, uint64 deadline, string cid);
    event ContributionReceived(uint256 indexed id, address indexed contributor, uint256 amount, uint256 cfdMinted);
    event RefundIssued(uint256 indexed id, address indexed contributor, uint256 amount, uint256 cfdBurned);
    event WithdrawalAuthorized(uint256 indexed id, uint256 amount, uint256 totalApproved);
    event WithdrawalExecuted(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event CampaignFrozen(uint256 indexed id);
    event CampaignUnfrozen(uint256 indexed id);

    error UnknownCampaign();
    error InvalidParameters();
    error CampaignClosed();
    error CampaignIsFrozen();
    error ContributionTooLow();
    error NotRefundable();
    error NothingToRefund();
    error NotBeneficiary();
    error NothingToWithdraw();
    error ExceedsRaised();
    error TransferFailed();

    constructor(address token_, address admin) {
        require(token_ != address(0) && admin != address(0), "Zero address");
        token = CFDToken(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ------------------------------------------------------------ Campagnes

    function createCampaign(address beneficiary, uint256 goal, uint256 duration, string calldata cid)
        external returns (uint256 id)
    {
        if (beneficiary == address(0) || goal == 0 || duration == 0 || duration > MAX_DURATION) {
            revert InvalidParameters();
        }
        id = ++campaignCount;
        uint64 deadline = uint64(block.timestamp + duration);
        _campaigns[id] = Campaign(beneficiary, deadline, false, goal, 0, 0, 0, cid);
        emit CampaignCreated(id, beneficiary, goal, deadline, cid);
    }

    function contribute(uint256 id) external payable {
        Campaign storage c = _get(id);
        if (c.frozen) revert CampaignIsFrozen();
        if (block.timestamp >= c.deadline) revert CampaignClosed();
        if (msg.value < MIN_CONTRIBUTION) revert ContributionTooLow();

        contributions[id][msg.sender] += msg.value;
        c.raised += msg.value;

        uint256 cfd = msg.value * RATE;
        token.mint(msg.sender, cfd);
        emit ContributionReceived(id, msg.sender, msg.value, cfd);
    }

    // --------------------------------------------------------- Remboursement

    /// @notice Possible si la campagne est gelée, ou si la date limite est
    ///         passée sans que l'objectif soit atteint. Remboursement au
    ///         prorata de ce qui reste dans la campagne ; les CFD sont brûlés.
    function refund(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        bool failed = block.timestamp >= c.deadline && c.raised < c.goal;
        if (!c.frozen && !failed) revert NotRefundable();

        uint256 paid = contributions[id][msg.sender];
        if (paid == 0) revert NothingToRefund();

        // Effects
        contributions[id][msg.sender] = 0;
        uint256 amount = (paid * (c.raised - c.withdrawn)) / c.raised;

        // Interactions
        uint256 cfd = paid * RATE;
        token.burn(msg.sender, cfd);   // revert si l'utilisateur n'a plus ses CFD
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit RefundIssued(id, msg.sender, amount, cfd);
    }

    // ---------------------------------------------------- Retrait bénéficiaire

    function withdraw(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        if (msg.sender != c.beneficiary) revert NotBeneficiary();
        if (c.frozen) revert CampaignIsFrozen();

        uint256 amount = c.approved - c.withdrawn;
        if (amount == 0) revert NothingToWithdraw();

        c.withdrawn += amount;                       // Effects
        (bool ok, ) = c.beneficiary.call{value: amount}("");   // Interactions
        if (!ok) revert TransferFailed();
        emit WithdrawalExecuted(id, c.beneficiary, amount);
    }

    // ------------------------------------------------------ Réservé à la DAO

    function freezeCampaign(uint256 id) external override onlyRole(GOVERNANCE_ROLE) {
        Campaign storage c = _get(id);
        c.frozen = true;
        emit CampaignFrozen(id);
    }

    function unfreezeCampaign(uint256 id) external onlyRole(GOVERNANCE_ROLE) {
        Campaign storage c = _get(id);
        c.frozen = false;
        emit CampaignUnfrozen(id);
    }

    /// @notice Autorise `amount` wei supplémentaires pour le bénéficiaire.
    function approveEarlyRelease(uint256 id, uint256 amount) external override onlyRole(GOVERNANCE_ROLE) {
        Campaign storage c = _get(id);
        if (c.frozen) revert CampaignIsFrozen();
        if (amount == 0 || c.approved + amount > c.raised) revert ExceedsRaised();
        c.approved += amount;
        emit WithdrawalAuthorized(id, amount, c.approved);
    }

    // --------------------------------------------------------------- Lectures

    function isActive(uint256 id) external view override returns (bool) {
        if (id == 0 || id > campaignCount) return false;
        Campaign storage c = _campaigns[id];
        return !c.frozen && block.timestamp < c.deadline;
    }

    function beneficiaryOf(uint256 id) external view override returns (address) {
        return _get(id).beneficiary;
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return _get(id);
    }

    function _get(uint256 id) internal view returns (Campaign storage) {
        if (id == 0 || id > campaignCount) revert UnknownCampaign();
        return _campaigns[id];
    }
}