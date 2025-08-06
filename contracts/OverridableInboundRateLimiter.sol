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
     * @dev The length of _exemptAddresses must match.
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
     * @dev The length of _guids and _areOverridable must match.
     */
    function modifyOverridableGUIDs(bytes32[] calldata _guids, bool _isOverridable) external onlyOwner {
        for (uint256 i; i < _guids.length; ++i) {
            bytes32 guid = _guids[i];
            guidOverrides[guid] = _isOverridable;

            if (_isOverridable) {
                emit RateLimitOverrider_AddedGUID(guid);
            } else {
                emit RateLimitOverrider_RemovedGUID(guid);
            }
        }
    }

    /**
     * @notice Handles the inflow with overridable addresses or GUIDs.
     * @param _guid The GUID associated with the transfer.
     * @param _address The address associated with the transfer.
     * @param _srcEid The source endpoint ID.
     * @param _amount The amount being transferred.
     */
    function _inflowOverridable(bytes32 _guid, address _address, uint256 _amount, uint32 _srcEid) internal {
        if (exemptAddresses[_address]) {
            emit RateLimitOverridden(_address, _amount);
            return;
        } else if (guidOverrides[_guid]) {
            emit RateLimitOverriddenByGUID(_guid, _amount);
            return;
        }
        _inflow(_srcEid, _amount);
    }

    /**
     * @notice Overrides the outflow function to handle the rate limit for outbound transfers.
     * @dev This function will never revert as super._inflow() has a lower bound of 0 in the original outbound rate limiter.
     * @param _dstEid The destination endpoint ID.
     * @param _amount The amount being transferred.
     */
    function _outflow(uint32 _dstEid, uint256 _amount) internal override {
        /// @dev The original layerzero rate limiter is used to track the outbound rate limit.
        /// @dev A unidirectional graph can be inverted by swapping the inflow and outflow functions.
        super._inflow(_dstEid, _amount);
    }

    /**
     * @notice Overrides the inflow function to handle the rate limit for inbound transfers.
     * @dev This function can revert as super._outflow() checks the rate limit in an outbound rate limiter
     * @dev This function should never be called directly as it is meant to be used by the _inflowOverridable function.
     * @param _srcEid The source endpoint ID.
     * @param _amount The amount being transferred.
     */
    function _inflow(uint32 _srcEid, uint256 _amount) internal override {
        /// @dev The original layerzero rate limiter is used to track the outbound rate limit.
        /// @dev A unidirectional graph can be inverted by swapping the inflow and outflow functions.
        super._outflow(_srcEid, _amount);
    }
}
