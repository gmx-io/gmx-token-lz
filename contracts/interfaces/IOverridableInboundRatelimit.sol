// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

struct RateLimitExemptAddress {
    address addr;
    bool isExempt;
}
interface IOverridableInboundRatelimit {
    error InputLengthMismatch(uint256 addressOrGUIDLength, uint256 overridableLength); // 0x6b7f6f0e

    event RateLimitUpdated(RateLimiter.RateLimitConfig[] newConfigs);

    event RateLimitOverrider_ModifiedAddress(RateLimitExemptAddress[] indexed addresses);
    event RateLimitOverrider_ModifiedGUID(bytes32[] indexed guid, bool canOverride);

    /// ------------------------------------------------------------------------------
    /// Storage Variables
    /// ------------------------------------------------------------------------------
    function exemptAddresses(address addr) external view returns (bool isExempt);
    function guidOverrides(bytes32 guid) external view returns (bool canOverride);

    /*
     * @notice Sets the rate limits for the contract.
     * @param _rateLimitConfigs The rate limit configurations to set.
     * @dev This function can only be called by the owner of the contract.
     * @dev Emits a RateLimitUpdated event.
     */
    function setRateLimits(RateLimiter.RateLimitConfig[] calldata rateLimitConfigs) external;

    /*
     * @notice Modifies the rate limit exempt addresses in bulk.
     * @dev This function allows the owner to set multiple addresses as exempt or not exempt.
     * @param _exemptAddresses The addresses to modify as an object of (address, isExempt).
     */
    function modifyRateLimitExemptAddresses(RateLimitExemptAddress[] calldata _exemptAddresses) external;

    /*
     * @notice Modifies the overridable GUIDs in bulk.
     * @dev This function allows the owner to set multiple GUIDs as overridable or not overridable.
     * @param guids The GUIDs to modify.
     * @param canOverride The boolean values indicating whether each GUID is overridable (or not) from the rate limit.
     * @dev canOverride is applied to all GUIDs in the array.
     */
    function modifyOverridableGUIDs(bytes32[] calldata guids, bool canOverride) external;
}
