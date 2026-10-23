// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICFDVotes} from "./interfaces/ICFDVotes.sol";
import {ICrowdfunding} from "./interfaces/ICrowdfunding.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Gouvernance DAO du crowdfunding
/// @notice Les détenteurs de CFD votent pour geler une campagne ou débloquer des fonds en avance
contract CFDGovernance is AccessControl, Pausable {
    // ───────── 1. Types ─────────
    enum ProposalType { Freeze, EarlyRelease }
    enum ProposalState { Active, Defeated, Succeeded, Executed }

    // ───────── 2. La fiche d'une proposition ─────────
    struct Proposal {
        ProposalType pType;    // gel ou déblocage
        uint256 campaignId;    // campagne concernée
        uint256 amount;        // montant (déblocage uniquement)
        address proposer;      // qui a proposé
        uint48 snapshot;       // LA PHOTO des voix
        uint64 voteEnd;        // fin du vote
        uint256 forVotes;      // total des OUI
        uint256 againstVotes;  // total des NON
        bool executed;         // déjà appliquée ?
    }

    // ───────── 3. Paramètres (décidés en équipe) ─────────
    uint256 public constant VOTING_PERIOD = 48 hours;
    uint256 public constant QUORUM_PERCENT = 20;
    uint256 public constant PROPOSAL_THRESHOLD = 100e18; // 100 CFD
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ───────── 4. Liens vers les contrats du Membre 1 ─────────
    ICFDVotes public immutable token;
    ICrowdfunding public immutable crowdfunding;

    // ───────── 5. Stockage ─────────
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ───────── 6. Erreurs ─────────
    error ZeroAddress();
    error CampaignNotActive();
    error NotBeneficiary();
    error BelowProposalThreshold();
    error InvalidAmount();
    error ProposalNotFound();
    error VotingClosed();
    error AlreadyVoted();
    error NoVotingPower();
    error NotSucceeded();

    // ───────── 7. Événements ─────────
    event ProposalCreated(
        uint256 indexed id, ProposalType pType, uint256 indexed campaignId,
        uint256 amount, address indexed proposer, uint48 snapshot, uint64 voteEnd
    );
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);

    // ───────── 8. Constructeur ─────────
    /// @param admin reçoit les badges admin et pause (en production : la multisig)
    constructor(ICFDVotes _token, ICrowdfunding _crowdfunding, address admin) {
        if (
            address(_token) == address(0) ||
            address(_crowdfunding) == address(0) ||
            admin == address(0)
        ) {
            revert ZeroAddress();
        }
        token = _token;
        crowdfunding = _crowdfunding;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ───────── Pause d'urgence (circuit breaker) ─────────
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ───────── 9. Créer une proposition ─────────
    function propose(ProposalType pType, uint256 campaignId, uint256 amount)
        external
        whenNotPaused
        returns (uint256 id)
    {
        // ── A. VÉRIFICATIONS ──
        if (!crowdfunding.isActive(campaignId)) revert CampaignNotActive();

        uint48 snapshot = token.clock() - 1; // la PHOTO : le moment juste avant

        if (pType == ProposalType.EarlyRelease) {
            // Seul le bénéficiaire peut demander son argent en avance
            if (msg.sender != crowdfunding.beneficiaryOf(campaignId)) revert NotBeneficiary();
            if (amount == 0) revert InvalidAmount();
        } else {
            // Gel : il faut au moins 100 CFD sur la photo (anti-spam)
            if (token.getPastVotes(msg.sender, snapshot) < PROPOSAL_THRESHOLD) {
                revert BelowProposalThreshold();
            }
            if (amount != 0) revert InvalidAmount();
        }

        // ── B. ENREGISTREMENT DE LA FICHE ──
        id = ++proposalCount;
        Proposal storage p = proposals[id];
        p.pType = pType;
        p.campaignId = campaignId;
        p.amount = amount;
        p.proposer = msg.sender;
        p.snapshot = snapshot;
        p.voteEnd = uint64(block.timestamp + VOTING_PERIOD);

        // ── C. JOURNAL ──
        emit ProposalCreated(id, pType, campaignId, amount, msg.sender, snapshot, p.voteEnd);
    }

    // ───────── 10. Voter (reste ouvert pendant une pause) ─────────
    function castVote(uint256 id, bool support) external {
        Proposal storage p = proposals[id];

        // ── A. VÉRIFICATIONS ──
        if (p.voteEnd == 0) revert ProposalNotFound();                // la proposition existe ?
        if (block.timestamp >= p.voteEnd) revert VotingClosed();     // le vote est encore ouvert ?
        if (hasVoted[id][msg.sender]) revert AlreadyVoted();         // pas de double vote

        uint256 weight = token.getPastVotes(msg.sender, p.snapshot); // poids SUR LA PHOTO
        if (weight == 0) revert NoVotingPower();

        // ── B. ENREGISTREMENT ──
        hasVoted[id][msg.sender] = true;
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        // ── C. JOURNAL ──
        emit VoteCast(id, msg.sender, support, weight);
    }

    // ───────── 11. Résultat du vote ─────────

    /// @notice Nombre de voix minimum pour que le vote soit valable (20 % des CFD sur la photo)
    function quorum(uint256 id) public view returns (uint256) {
        return token.getPastTotalSupply(proposals[id].snapshot) * QUORUM_PERCENT / 100;
    }

    /// @notice Où en est la proposition ?
    function state(uint256 id) public view returns (ProposalState) {
        Proposal storage p = proposals[id];

        if (p.voteEnd == 0) revert ProposalNotFound();
        if (p.executed) return ProposalState.Executed;
        if (block.timestamp < p.voteEnd) return ProposalState.Active;

        bool quorumReached = p.forVotes + p.againstVotes >= quorum(id);
        bool majority = p.forVotes > p.againstVotes;

        if (quorumReached && majority) return ProposalState.Succeeded;
        return ProposalState.Defeated;
    }

    // ───────── 12. Appliquer la décision ─────────
    function execute(uint256 id) external whenNotPaused {
        // ── A. VÉRIFICATION ──
        if (state(id) != ProposalState.Succeeded) revert NotSucceeded();

        Proposal storage p = proposals[id];

        // ── B. ENREGISTREMENT (AVANT l'appel externe) ──
        p.executed = true;

        // ── C. ACTION sur le contrat du Membre 1 ──
        if (p.pType == ProposalType.Freeze) {
            crowdfunding.freezeCampaign(p.campaignId);
        } else {
            crowdfunding.approveEarlyRelease(p.campaignId, p.amount);
        }

        emit ProposalExecuted(id);
    }
}