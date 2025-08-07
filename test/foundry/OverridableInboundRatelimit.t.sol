// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { OverridableInboundRateLimiterMock, RateLimiter, RateLimitExemptAddress } from "../mocks/OverridableInboundRatelimitMock.sol";

import { console, Test } from "forge-std/Test.sol";

contract OverridableInboundRatelimitTest is Test {
    OverridableInboundRateLimiterMock private rateLimiter;

    address private userA = makeAddr("userA");
    address private overrideUser = makeAddr("overrideUser");

    uint256 private initialBalance = 100 ether;
    uint256 private overrideAmount = 10 ether;

    uint256 private rateLimit = 1 ether;
    uint256 private window = 1000;

    uint32 private eid = 1;

    bytes32 private randGUID;

    function setUp() public {
        RateLimiter.RateLimitConfig[] memory rateLimitConfigs = new RateLimiter.RateLimitConfig[](1);
        rateLimitConfigs[0] = RateLimiter.RateLimitConfig({ dstEid: eid, limit: rateLimit, window: window });

        rateLimiter = new OverridableInboundRateLimiterMock(rateLimitConfigs);

        RateLimitExemptAddress[] memory exemptAddresses = new RateLimitExemptAddress[](1);
        exemptAddresses[0] = RateLimitExemptAddress({ addr: overrideUser, isExempt: true });

        rateLimiter.modifyRateLimitExemptAddresses(exemptAddresses);

        randGUID = bytes32(vm.randomBytes(32));
    }

    function test_deployment() public view {
        assertEq(rateLimiter.owner(), address(this));

        assertEq(rateLimiter.exemptAddresses(userA), false);
        assertEq(rateLimiter.exemptAddresses(overrideUser), true);

        assertGt(overrideAmount, rateLimit);
    }

    function test_outflow_without_override_sender(uint256 _amount) public {
        rateLimiter.outflow(eid, _amount);
    }

    function test_inflow_without_override_receiver() public {
        vm.expectRevert(abi.encodeWithSelector(RateLimiter.RateLimitExceeded.selector));
        rateLimiter.inflow(eid, overrideAmount);
    }

    function test_inflowOverride_without_override_receiver() public {
        vm.expectRevert(abi.encodeWithSelector(RateLimiter.RateLimitExceeded.selector));
        rateLimiter.inflowOverridable(randGUID, userA, overrideAmount, eid);

        bytes32[] memory guids = new bytes32[](1);
        bool overridables = true;
        guids[0] = randGUID;

        rateLimiter.modifyOverridableGUIDs(guids, overridables);
        rateLimiter.inflowOverridable(randGUID, userA, overrideAmount, eid);
    }

    function test_inflowOverride_with_override_receiver() public {
        rateLimiter.inflowOverridable(randGUID, overrideUser, overrideAmount, eid);
    }

    function testFuzz_inflowOverride_with_override_receiver(uint256 _amount) public {
        rateLimiter.inflowOverridable(randGUID, overrideUser, _amount, eid);
    }
}
