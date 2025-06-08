// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

import { IOverridableInboundRatelimit } from "./interfaces/IOverridableInboundRatelimit.sol";

/**
 * @title Inbound rate limiter with override functionality
 * @author @shankars99 (Shankar)
 * @dev The original layerzero rate limiter is an outbound rate limiter designed to keep tokens within the vertices (networks)
 * @dev This rate limiter is an inbound rate limiter designed to keep overflowing tokens within the edges (pathways)
 * @dev We also have an override feature where the rate limit is NOT triggered by certain addresses.
 * @dev This allows for protocol contracts to rebalance or move tokens between networks without being rate limited.
 */
abstract contract OverridableInboundRateLimiter is IOverridableInboundRatelimit, RateLimiter, Ownable {
    mapping(address => bool) public canOverrideRateLimit;
    mapping(bytes32 => bool) public overridableGUIDs;

    function modifyRateLimitOverrideList(
        address[] calldata _addresses,
        bool[] calldata _areOverridable
    ) external onlyOwner {
        if (_addresses.length != _areOverridable.length) revert();

        for (uint256 i; i < _addresses.length; ++i) {
            address currAddress = _addresses[i];
            bool isOverridable = _areOverridable[i];

            canOverrideRateLimit[currAddress] = isOverridable;

            if (isOverridable) {
                emit RateLimitOverrider_AddedAddress(currAddress);
            } else {
                emit RateLimitOverrider_RemovedAddress(currAddress);
            }
        }
    }

    function modifyOverridableGUIDs(bytes32[] calldata _guids, bool[] calldata _areOverridable) external onlyOwner {
        if (_guids.length != _areOverridable.length) revert();

        for (uint256 i; i < _guids.length; ++i) {
            bytes32 currGUID = _guids[i];
            bool isOverridable = _areOverridable[i];

            overridableGUIDs[currGUID] = isOverridable;

            if (isOverridable) {
                emit RateLimitOverrider_AddedGUID(currGUID);
            } else {
                emit RateLimitOverrider_RemovedGUID(currGUID);
            }
        }
    }

    function _outflow(uint32 _dstEid, uint256 _amount) internal override {
        /// @dev The original layerzero rate limiter is used to track the outbound rate limit.
        /// @dev A unidirectional graph can be inverted by swapping the inflow and outflow functions.
        super._inflow(_dstEid, _amount);
    }

    function _inflow(uint32 _srcEid, uint256 _amount) internal override {
        /// @dev The original layerzero rate limiter is used to track the inbound rate limit.
        /// @dev If the address is in the override list, the rate limit is overridden.
        super._outflow(_srcEid, _amount);
    }

    function _inflowOverridable(bytes32 _guid, address _address, uint32 _srcEid, uint256 _amount) internal {
        if (canOverrideRateLimit[_address] || overridableGUIDs[_guid]) {
            emit RateLimitOverrided(_address, _amount);
            return;
        }
        _inflow(_srcEid, _amount);
    }
}
