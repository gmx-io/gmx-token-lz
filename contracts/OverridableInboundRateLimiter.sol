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
    mapping(address => bool) public exemptAddresses;
    mapping(bytes32 => bool) public guidOverrides;

    function modifyRateLimitOverrideAddresses(
        address[] calldata _addresses,
        bool[] calldata _areOverridable
    ) external onlyOwner {
        uint256 addressLength = _addresses.length;
        if (addressLength != _areOverridable.length) revert InputLengthMismatch(addressLength, _areOverridable.length);

        for (uint256 i; i < addressLength; ++i) {
            modifyRateLimitOverrideAddress(_addresses[i], _areOverridable[i]);
        }
    }

    function modifyOverridableGUIDs(bytes32[] calldata _guids, bool[] calldata _areOverridable) external onlyOwner {
        uint256 guidLength = _guids.length;
        if (guidLength != _areOverridable.length) revert InputLengthMismatch(guidLength, _areOverridable.length);

        for (uint256 i; i < guidLength; ++i) {
            modifyOverridableGUID(_guids[i], _areOverridable[i]);
        }
    }

    function modifyRateLimitOverrideAddress(address _address, bool _isOverridable) public onlyOwner {
        exemptAddresses[_address] = _isOverridable;

        if (_isOverridable) {
            emit RateLimitOverrider_AddedAddress(_address);
        } else {
            emit RateLimitOverrider_RemovedAddress(_address);
        }
    }

    function modifyOverridableGUID(bytes32 _guid, bool _isOverridable) public onlyOwner {
        guidOverrides[_guid] = _isOverridable;

        if (_isOverridable) {
            emit RateLimitOverrider_AddedGUID(_guid);
        } else {
            emit RateLimitOverrider_RemovedGUID(_guid);
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
        if (exemptAddresses[_address]) {
            emit RateLimitOverridden(_address, _amount);
            return;
        } else if (guidOverrides[_guid]) {
            emit RateLimitOverriddenByGUID(_guid, _amount);
            return;
        }
        _inflow(_srcEid, _amount);
    }
}
