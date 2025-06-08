// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

interface IOverridableInboundRatelimit {
    error PayloadNotFound();

    event Error_RateLimitExceeded(uint256 amount, uint256 rateLimitAmount);

    event RateLimitOverrider_AddedAddress(address);
    event RateLimitOverrider_RemovedAddress(address);
    event RateLimitOverrider_AddedGUID(bytes32);
    event RateLimitOverrider_RemovedGUID(bytes32);

    event RateLimitUpdated(RateLimiter.RateLimitConfig[] newConfigs);
    event RateLimitOverrided(address to, uint256 amount);
    event RateLimitOverridedByGUID(bytes32 guid, uint256 amount);

    function canOverrideRateLimit(address) external view returns (bool);
    function overridableGUIDs(bytes32) external view returns (bool);

    function modifyRateLimitOverrideList(address[] calldata, bool[] calldata) external;
    function modifyOverridableGUIDs(bytes32[] calldata _guids, bool[] calldata _areOverridable) external;
}
