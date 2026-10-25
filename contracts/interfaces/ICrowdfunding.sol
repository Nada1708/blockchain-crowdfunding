// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Ce que la DAO attend du contrat Crowdfunding (Membre 1)
interface ICrowdfunding {
    /// Lectures : vérifier une campagne avant une proposition
    function isActive(uint256 campaignId) external view returns (bool);
    function beneficiaryOf(uint256 campaignId) external view returns (address);

    /// Actions : appelables UNIQUEMENT par la DAO
    function freezeCampaign(uint256 campaignId) external;
    function approveEarlyRelease(uint256 campaignId, uint256 amount) external;
}