// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

import { IOverridableInboundRatelimit } from "./interfaces/IOverridableInboundRatelimit.sol";

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
     * @param _addresses The addresses to modify.
     * @param _areOverridable The boolean values indicating whether each address is exempt (or not) from the rate limit.
     * @dev The length of _addresses and _areOverridable must match.
     */
    function modifyRateLimitExemptAddresses(
        address[] calldata _addresses,
        bool[] calldata _areOverridable
    ) external onlyOwner {
        uint256 addressLength = _addresses.length;
        if (addressLength != _areOverridable.length) revert InputLengthMismatch(addressLength, _areOverridable.length);

        for (uint256 i; i < addressLength; ++i) {
            modifyRateLimitExemptAddress(_addresses[i], _areOverridable[i]);
        }
    }

    /**
     * @notice Modifies the overridable GUIDs in bulk.
     * @dev This function allows the owner to set multiple GUIDs as overridable or not overridable.
     * @param _guids The GUIDs to modify.
     * @param _areOverridable The boolean values indicating whether each GUID is overridable (or not) from the rate limit.
     * @dev The length of _guids and _areOverridable must match.
     */
    function modifyOverridableGUIDs(bytes32[] calldata _guids, bool[] calldata _areOverridable) external onlyOwner {
        uint256 guidLength = _guids.length;
        if (guidLength != _areOverridable.length) revert InputLengthMismatch(guidLength, _areOverridable.length);

        for (uint256 i; i < guidLength; ++i) {
            modifyOverridableGUID(_guids[i], _areOverridable[i]);
        }
    }

    /**
     * @notice Modifies a single rate limit exempt address.
     * @param _address The address to modify.
     * @param _isOverridable Whether the address is exempt from the rate limit.
     * @dev Emits an event indicating whether the address was added or removed from the override list.
     */
    function modifyRateLimitExemptAddress(address _address, bool _isOverridable) public onlyOwner {
        exemptAddresses[_address] = _isOverridable;

        if (_isOverridable) {
            emit RateLimitOverrider_AddedAddress(_address);
        } else {
            emit RateLimitOverrider_RemovedAddress(_address);
        }
    }

    /**
     * @notice Modifies a single overridable GUID.
     * @param _guid The GUID to modify.
     * @param _isOverridable Whether the GUID is overridable from the rate limit.
     * @dev Emits an event indicating whether the GUID was added or removed from the override list.
     */
    function modifyOverridableGUID(bytes32 _guid, bool _isOverridable) public onlyOwner {
        guidOverrides[_guid] = _isOverridable;

        if (_isOverridable) {
            emit RateLimitOverrider_AddedGUID(_guid);
        } else {
            emit RateLimitOverrider_RemovedGUID(_guid);
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
