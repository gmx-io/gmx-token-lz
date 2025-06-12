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
    event RateLimitOverridden(address to, uint256 amount);
    event RateLimitOverriddenByGUID(bytes32 guid, uint256 amount);

    function exemptAddresses(address) external view returns (bool);
    function guidOverrides(bytes32) external view returns (bool);

    function modifyRateLimitOverrideAddresses(address[] calldata, bool[] calldata) external;
    function modifyOverridableGUIDs(bytes32[] calldata, bool[] calldata) external;
    function modifyRateLimitOverrideAddress(address, bool) external;
    function modifyOverridableGUID(bytes32, bool) external;
}
