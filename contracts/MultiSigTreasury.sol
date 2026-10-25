// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Coffre multisignature 2-sur-3
/// @notice Toute opération exige 2 confirmations distinctes parmi 3 signataires
contract MultiSigTreasury is ReentrancyGuard {
    // ───────── 1. Règle ─────────
    uint256 public constant REQUIRED = 2;

    // ───────── 2. La fiche d'une opération ─────────
    struct Transaction {
        address to;           // destinataire (un compte ou un contrat)
        uint256 value;        // ETH à envoyer
        bytes data;           // l'ordre à exécuter (vide pour un simple envoi d'ETH)
        bool executed;        // déjà exécutée ?
        uint8 confirmations;  // nombre de signatures
    }

    // ───────── 3. Stockage ─────────
    address[3] public signers;
    mapping(address => bool) public isSigner;
    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    // ───────── 4. Erreurs ─────────
    error InvalidSigners();
    error NotSigner();
    error TxNotFound();
    error AlreadyExecuted();
    error AlreadyConfirmed();
    error NotConfirmed();
    error NotEnoughConfirmations();
    error CallFailed();

    // ───────── 5. Événements ─────────
    event Deposit(address indexed from, uint256 amount);
    event Submitted(uint256 indexed id, address indexed signer, address to, uint256 value);
    event Confirmed(uint256 indexed id, address indexed signer);
    event Revoked(uint256 indexed id, address indexed signer);
    event Executed(uint256 indexed id);

    // ───────── 6. Contrôles réutilisables ─────────
    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    modifier pending(uint256 id) {
        if (id >= transactions.length) revert TxNotFound();
        if (transactions[id].executed) revert AlreadyExecuted();
        _;
    }

    // ───────── 7. Constructeur : 3 signataires distincts ─────────
    constructor(address[3] memory _signers) {
        for (uint256 i = 0; i < 3; i++) {
            address s = _signers[i];
            if (s == address(0) || isSigner[s]) revert InvalidSigners();
            isSigner[s] = true;
            signers[i] = s;
        }
    }

    /// @notice Le coffre peut recevoir des ETH
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    // ───────── 8. Proposer (compte comme 1re signature) ─────────
    function submit(address to, uint256 value, bytes calldata data)
        external onlySigner returns (uint256 id)
    {
        id = transactions.length;
        transactions.push(Transaction(to, value, data, false, 0));
        emit Submitted(id, msg.sender, to, value);
        _confirm(id);
    }

    // ───────── 9. Confirmer ─────────
    function confirm(uint256 id) external onlySigner pending(id) {
        _confirm(id);
    }

    function _confirm(uint256 id) internal {
        if (confirmed[id][msg.sender]) revert AlreadyConfirmed();
        confirmed[id][msg.sender] = true;
        transactions[id].confirmations += 1;
        emit Confirmed(id, msg.sender);
    }

    // ───────── 10. Retirer sa signature ─────────
    function revoke(uint256 id) external onlySigner pending(id) {
        if (!confirmed[id][msg.sender]) revert NotConfirmed();
        confirmed[id][msg.sender] = false;
        transactions[id].confirmations -= 1;
        emit Revoked(id, msg.sender);
    }

    // ───────── 11. Exécuter ─────────
    function execute(uint256 id) external onlySigner pending(id) nonReentrant {
        Transaction storage t = transactions[id];
        if (t.confirmations < REQUIRED) revert NotEnoughConfirmations();

        t.executed = true;                                    // EFFECT d'abord
        (bool ok, ) = t.to.call{value: t.value}(t.data);      // INTERACTION ensuite
        if (!ok) revert CallFailed();

        emit Executed(id);
    }
}