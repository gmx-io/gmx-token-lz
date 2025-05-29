// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

interface IGMX_Adapter {
    event NewRateLimitOverrider(bytes32);
    event RateLimitUpdated(RateLimiter.RateLimitConfig[] newConfigss);
    event RateLimitOverrided(bytes32 to, uint256 amountLD);

    function modifyRateLimitOverrideList(address, bool) external;
    function modifyRateLimitOverrideList(bytes32, bool) external;

    function canOverrideRateLimit(bytes32) external view returns (bool);
}
