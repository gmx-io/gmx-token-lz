// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

interface IOverridableInboundRatelimit {
    event RateLimitOverrider_Added(address);
    event RateLimitOverrider_Removed(address);

    event RateLimitUpdated(RateLimiter.RateLimitConfig[] newConfigs);
    event RateLimitOverrided(address to, uint256 amount);

    function modifyRateLimitOverrideList(address, bool) external;

    function canOverrideRateLimit(address) external view returns (bool);
}
