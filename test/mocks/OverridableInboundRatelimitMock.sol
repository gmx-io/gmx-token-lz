// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";
import { IOverridableInboundRatelimit, RateLimitExemptAddress } from "../../contracts/interfaces/IOverridableInboundRatelimit.sol";

contract OverridableInboundRateLimiterMock is RateLimiter, Ownable {
    mapping(address => bool) public exemptAddresses;
    mapping(bytes32 => bool) public guidOverrides;

    constructor(RateLimiter.RateLimitConfig[] memory _rateLimitConfigs) Ownable(msg.sender) {
        _setRateLimits(_rateLimitConfigs);
    }

    /**
     * @notice Sets the rate limits for the contract.
     * @param _rateLimitConfigs The rate limit configurations to set.
     * @dev This function can only be called by the owner of the contract.
     * @dev Emits a RateLimitUpdated event.
     */
    function setRateLimits(RateLimitConfig[] calldata _rateLimitConfigs) external onlyOwner {
        _setRateLimits(_rateLimitConfigs);
        emit IOverridableInboundRatelimit.RateLimitUpdated(_rateLimitConfigs);
    }

    /**
     * @notice Modifies the rate limit exempt addresses in bulk.
     * @dev This function allows the owner to set multiple addresses as exempt or not exempt.
     * @param _exemptAddresses The addresses to modify as an object of (address, isExempt).
     */
    function modifyRateLimitExemptAddresses(RateLimitExemptAddress[] calldata _exemptAddresses) external onlyOwner {
        for (uint256 i; i < _exemptAddresses.length; ++i) {
            exemptAddresses[_exemptAddresses[i].addr] = _exemptAddresses[i].isExempt;
        }

        emit IOverridableInboundRatelimit.RateLimitOverrider_ModifiedAddress(_exemptAddresses);
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
            guidOverrides[_guids[i]] = _canOverride;
        }
        emit IOverridableInboundRatelimit.RateLimitOverrider_ModifiedGUID(_guids, _canOverride);
    }

    function outflow(uint32 _dstEid, uint256 _amount) public {
        super._inflow(_dstEid, _amount);
    }

    function inflow(uint32 _srcEid, uint256 _amount) public {
        super._outflow(_srcEid, _amount);
    }

    function inflowOverridable(bytes32 _guid, address _to, uint256 _amount, uint32 _srcEid) public {
        if (!exemptAddresses[_to] && !guidOverrides[_guid]) {
            inflow(_srcEid, _amount);
        }
    }
}
