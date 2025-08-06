// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

interface IOverridableInboundRatelimit {
    error InputLengthMismatch(uint256 addressOrGUIDLength, uint256 overridableLength); // 0x6b7f6f0e

    event RateLimitOverrider_AddedAddress(address indexed addr); // 0x56fc3b5c
    event RateLimitOverrider_RemovedAddress(address indexed addr); // 0x4cd63629
    event RateLimitOverrider_AddedGUID(bytes32 indexed guid); // 0x9d572935
    event RateLimitOverrider_RemovedGUID(bytes32 indexed guid); // 0x359cfb26

    event RateLimitUpdated(RateLimiter.RateLimitConfig[] newConfigs); // 0xe9cadf54
    event RateLimitOverridden(address indexed to, uint256 indexed amount); // 0xa02b263e
    event RateLimitOverriddenByGUID(bytes32 indexed guid, uint256 indexed amount); // 0x8132419b

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
     * @param _addresses The addresses to modify.
     * @param _areOverridable The boolean values indicating whether each address is exempt (or not) from the rate limit.
     * @dev The length of _addresses and _areOverridable must match.
     */
    function modifyRateLimitExemptAddresses(address[] calldata addrs, bool[] calldata isExempt) external;

    /*
     * @notice Modifies the overridable GUIDs in bulk.
     * @dev This function allows the owner to set multiple GUIDs as overridable or not overridable.
     * @param _guids The GUIDs to modify.
     * @param _areOverridable The boolean values indicating whether each GUID is overridable (or not) from the rate limit.
     * @dev The length of _guids and _areOverridable must match.
     */
    function modifyOverridableGUIDs(bytes32[] calldata guids, bool[] calldata canOverride) external;

    /*
     * @notice Modifies a single rate limit exempt address.
     * @param _address The address to modify.
     * @param _isOverridable Whether the address is exempt from the rate limit.
     * @dev Emits an event indicating whether the address was added or removed from the override list.
     */
    function modifyRateLimitExemptAddress(address addr, bool isExempt) external;

    /*
     * @notice Modifies a single overridable GUID.
     * @param _guid The GUID to modify.
     * @param _isOverridable Whether the GUID is overridable from the rate limit.
     * @dev Emits an event indicating whether the GUID was added or removed from the override list.
     */
    function modifyOverridableGUID(bytes32 guid, bool canOverride) external;
}
