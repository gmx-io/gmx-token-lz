// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

/**
 * @title IGMXMinterBurnable
 * @dev Interface for the GMX token contract with minting and burning functionality
 */
interface IGMXMinterBurnable {
    /**
     * @notice Burns tokens from an account
     * @param _account The account to burn tokens from
     * @param _amount The amount of tokens to burn
     * @dev Can only be called by authorized minters
     */
    function burn(address _account, uint256 _amount) external;

    /**
     * @notice Mints tokens to an account
     * @param _account The account to mint tokens to
     * @param _amount The amount of tokens to mint
     * @dev Can only be called by authorized minters
     */
    function mint(address _account, uint256 _amount) external;
}
