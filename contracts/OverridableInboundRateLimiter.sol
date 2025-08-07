// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

import { IOverridableInboundRatelimit, RateLimitExemptAddress } from "./interfaces/IOverridableInboundRatelimit.sol";

/**
 * @title Inbound rate limiter with override functionality
 * @author LayerZero Labs (@shankars99)
 * @dev The original layerzero rate limiter is an outbound rate limiter designed to keep tokens within the vertices (networks)
 * @dev This rate limiter is an inbound rate limiter designed to keep overflowing tokens within the edges (pathways)
 * @dev We also have an override feature where the rate limit is NOT triggered by certain addresses.
 * @dev This allows for protocol contracts to rebalance or move tokens between networks without being rate limited.
 */
abstract contract OverridableInboundRateLimiter is IOverridableInboundRatelimit, RateLimiter, Ownable {
    mapping(address => bool) public exemptAddresses;
    mapping(bytes32 => bool) public guidOverrides;

    /**
     * @notice Sets the rate limits for the contract.
     * @param _rateLimitConfigs The rate limit configurations to set.
     * @dev This function can only be called by the owner of the contract.
     * @dev Emits a RateLimitUpdated event.
     */
    function setRateLimits(RateLimitConfig[] calldata _rateLimitConfigs) external onlyOwner {
        _setRateLimits(_rateLimitConfigs);
        emit RateLimitUpdated(_rateLimitConfigs);
    }

    /**
     * @notice Modifies the rate limit exempt addresses in bulk.
     * @dev This function allows the owner to set multiple addresses as exempt or not exempt.
     * @param _exemptAddresses The addresses to modify as an object of (address, isExempt).
     */
    function modifyRateLimitExemptAddresses(RateLimitExemptAddress[] calldata _exemptAddresses) external onlyOwner {
        for (uint256 i; i < _exemptAddresses.length; ++i) {
            RateLimitExemptAddress calldata exemptAddress = _exemptAddresses[i];
            exemptAddresses[exemptAddress.addr] = exemptAddress.isExempt;

            if (exemptAddress.isExempt) {
                emit RateLimitOverrider_AddedAddress(exemptAddress.addr);
            } else {
                emit RateLimitOverrider_RemovedAddress(exemptAddress.addr);
            }
        }
    }

    /**
     * @notice Modifies the overridable GUIDs in bulk.
     * @dev This function allows the owner to set multiple GUIDs as overridable or not overridable.
     * @dev This is used when a message with a normal recipient has failed due to rate limiting.
     *      This allows the owner to override the rate limit for that GUID and that tx can be re-executed at the endpoint.
     * @param _guids The GUIDs to modify.
     * @dev `_canOverride` is applied to all GUIDs in the array.
     */
    function modifyOverridableGUIDs(bytes32[] calldata _guids, bool _canOverride) external onlyOwner {
        for (uint256 i; i < _guids.length; ++i) {
            bytes32 guid = _guids[i];
            guidOverrides[guid] = _canOverride;

            if (_canOverride) {
                emit RateLimitOverrider_AddedGUID(guid);
            } else {
                emit RateLimitOverrider_RemovedGUID(guid);
            }
        }
    }
}
