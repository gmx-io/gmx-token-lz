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
abstract contract OverridableInboundRateLimiter is RateLimiter, Ownable, IOverridableInboundRatelimit {
    mapping(address => bool) public canOverrideRateLimit;

    function modifyRateLimitOverrideList(address _address, bool _canOverride) external onlyOwner {
        canOverrideRateLimit[_address] = _canOverride;

        if (_canOverride) {
            emit RateLimitOverrider_Added(_address);
        } else {
            emit RateLimitOverrider_Removed(_address);
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

    function _inflowOverridable(address _address, uint32 _srcEid, uint256 _amount) internal {
        if (canOverrideRateLimit[_address]) {
            emit RateLimitOverrided(_address, _amount);
        } else {
            _inflow(_srcEid, _amount);
        }
    }
}
