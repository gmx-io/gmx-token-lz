// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { IGMXMinterBurnable } from "../../contracts/interfaces/IGMXMinterBurnable.sol";

/**
 * @title IGMXToken
 * @dev Interface for the GMX token contract with governance and minting functionality
 */
interface IGMXToken is IGMXMinterBurnable {
    /**
     * @notice Returns the governance address
     * @return The address of the governance contract
     */
    function gov() external view returns (address);

    /**
     * @notice Sets the minter status for an address
     * @param _minter The address to set minter status for
     * @param _isActive Whether the address should be a minter
     * @dev Can only be called by the governance address
     */
    function setMinter(address _minter, bool _isActive) external;

    /**
     * @notice Checks if an address is a minter
     * @param _minter The address to check
     * @return Whether the address is a minter
     */
    function isMinter(address _minter) external view returns (bool);
}
