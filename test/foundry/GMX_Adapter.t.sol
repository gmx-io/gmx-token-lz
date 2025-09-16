// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// OZ imports
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// OApp imports
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

// OFT imports
import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import { IOFT, SendParam, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { MessagingFee, MessagingReceipt } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";

import { OFTMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTMsgCodec.sol";

// Contract imports
import { RateLimitExemptAddress } from "../../contracts/interfaces/IOverridableInboundRateLimiter.sol";
import { GMX_MintBurnAdapter } from "../../contracts/GMX_MintBurnAdapter.sol";
import { GMX_LockboxAdapter } from "../../contracts/GMX_LockboxAdapter.sol";

// Mock imports
import { IGMXToken } from "../mocks/IGMXToken.sol";

// Forge imports
import { Test, console } from "forge-std/Test.sol";

contract GMX_AdapterForkTest is Test, RateLimiter {
    using OptionsBuilder for bytes;
    using OFTMsgCodec for address;

    // Network configuration
    uint32 private constant AVALANCHE_EID = 30106;
    uint32 private constant ARBITRUM_EID = 30110;

    // LayerZero V2 Endpoints
    address private constant AVALANCHE_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address private constant ARBITRUM_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // GMX token addresses from hardhat config
    address private constant GMX_AVALANCHE = 0x62edc0692BD897D2295872a9FFCac5425011c661;
    address private constant GMX_ARBITRUM = 0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a;

    // Contract instances
    GMX_MintBurnAdapter private avalancheMintBurnAdapter;
    GMX_LockboxAdapter private arbitrumLockboxAdapter;

    // Test accounts
    address private userA = makeAddr("userA");
    address private userB = makeAddr("userB");
    address private deployer = address(this);

    // Test parameters
    uint256 private constant INITIAL_BALANCE = 100 ether;
    uint256 private constant RATE_LIMIT = 10 ether;
    uint256 private constant RATE_WINDOW = 3600; // 1 hour

    function setUp() public {
        // Deploy on Arbitrum first
        vm.createSelectFork(vm.envString("RPC_URL_ARBITRUM_MAINNET"));

        // Setup rate limit configs for Arbitrum
        RateLimitConfig[] memory arbRateLimitConfigs = new RateLimitConfig[](1);
        arbRateLimitConfigs[0] = RateLimitConfig({ dstEid: AVALANCHE_EID, limit: RATE_LIMIT, window: RATE_WINDOW });

        // Deploy Arbitrum Lockbox adapter
        arbitrumLockboxAdapter = new GMX_LockboxAdapter(arbRateLimitConfigs, GMX_ARBITRUM, ARBITRUM_ENDPOINT, deployer);

        // Setup test users with tokens and ETH on Arbitrum
        vm.deal(userA, 10 ether);
        vm.deal(userB, 10 ether);

        address arbGov = IGMXToken(GMX_ARBITRUM).gov();
        // Mint GMX tokens to userA using the actual mint function
        vm.startPrank(arbGov);
        IGMXToken(GMX_ARBITRUM).setMinter(arbGov, true);
        IGMXToken(GMX_ARBITRUM).mint(userA, INITIAL_BALANCE);
        IGMXToken(GMX_ARBITRUM).setMinter(arbGov, false);
        vm.stopPrank();

        // Switch to Avalanche and deploy adapter there too
        vm.createSelectFork(vm.envString("RPC_URL_AVALANCHE_MAINNET"));

        // Setup rate limit configs for Avalanche
        RateLimitConfig[] memory avaxRateLimitConfigs = new RateLimitConfig[](1);
        avaxRateLimitConfigs[0] = RateLimitConfig({ dstEid: ARBITRUM_EID, limit: RATE_LIMIT, window: RATE_WINDOW });

        // Deploy Avalanche MintBurn adapter
        avalancheMintBurnAdapter = new GMX_MintBurnAdapter(
            avaxRateLimitConfigs,
            GMX_AVALANCHE,
            AVALANCHE_ENDPOINT,
            deployer
        );

        // Setup test users with tokens and ETH on Avalanche
        vm.deal(userA, 10 ether);
        vm.deal(userB, 10 ether);

        // Mint GMX tokens to userA using the actual mint function
        address avaxGov = IGMXToken(GMX_AVALANCHE).gov();
        vm.startPrank(avaxGov);
        IGMXToken(GMX_AVALANCHE).setMinter(avaxGov, true);
        IGMXToken(GMX_AVALANCHE).mint(userA, INITIAL_BALANCE);
        IGMXToken(GMX_AVALANCHE).setMinter(avaxGov, false);

        // Grant minter permissions to the adapter (since minterBurner is now the GMX token itself)
        IGMXToken(GMX_AVALANCHE).setMinter(address(avalancheMintBurnAdapter), true);
        vm.stopPrank();

        // Set up LayerZero peer relationships
        _setupLayerZeroPeers();
    }

    function _setupLayerZeroPeers() internal {
        // Set up peer relationship: Arbitrum -> Avalanche
        vm.selectFork(0); // Arbitrum fork
        arbitrumLockboxAdapter.setPeer(AVALANCHE_EID, address(avalancheMintBurnAdapter).addressToBytes32());

        // Set up peer relationship: Avalanche -> Arbitrum
        vm.selectFork(1); // Avalanche fork
        avalancheMintBurnAdapter.setPeer(ARBITRUM_EID, address(arbitrumLockboxAdapter).addressToBytes32());

        console.log("LayerZero peers configured");
    }

    function test_arbitrum_lockbox_deployment() public {
        // Switch to Arbitrum fork where the adapter was deployed
        vm.selectFork(0); // First fork created (Arbitrum)

        // Test Arbitrum lockbox adapter deployment
        assertEq(arbitrumLockboxAdapter.owner(), deployer);
        assertEq(arbitrumLockboxAdapter.token(), GMX_ARBITRUM);
        assertTrue(arbitrumLockboxAdapter.approvalRequired());

        // Check initial balances
        assertEq(IERC20(GMX_ARBITRUM).balanceOf(userA), INITIAL_BALANCE);
        assertEq(IERC20(GMX_ARBITRUM).balanceOf(address(arbitrumLockboxAdapter)), 0);
    }

    function test_avalanche_mintburn_deployment() public {
        // Switch to Avalanche fork where the adapter was deployed
        vm.selectFork(1); // Second fork created (Avalanche)

        assertEq(avalancheMintBurnAdapter.owner(), deployer);
        assertEq(avalancheMintBurnAdapter.token(), GMX_AVALANCHE);
        assertFalse(avalancheMintBurnAdapter.approvalRequired());

        assertTrue(IGMXToken(GMX_AVALANCHE).isMinter(address(avalancheMintBurnAdapter)));
    }

    function test_lockbox_token_approval() public {
        vm.selectFork(0); // Arbitrum fork

        uint256 tokensToSend = 1 ether;

        // User needs to approve the lockbox adapter to spend their tokens
        vm.prank(userA);
        IERC20(GMX_ARBITRUM).approve(address(arbitrumLockboxAdapter), tokensToSend);

        assertEq(IERC20(GMX_ARBITRUM).allowance(userA, address(arbitrumLockboxAdapter)), tokensToSend);
    }

    function test_arbitrum_lockbox_send_total_supply_consistency() public {
        vm.selectFork(0); // Arbitrum fork

        // Record initial total supply on Arbitrum
        uint256 initialTotalSupply = IERC20(GMX_ARBITRUM).totalSupply();
        uint256 tokensToSend = 5 ether;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);
        SendParam memory sendParam = SendParam({
            dstEid: AVALANCHE_EID,
            to: userB.addressToBytes32(),
            amountLD: tokensToSend,
            minAmountLD: tokensToSend,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        // Get fee and approve tokens
        MessagingFee memory fee = arbitrumLockboxAdapter.quoteSend(sendParam, false);
        vm.prank(userA);
        IERC20(GMX_ARBITRUM).approve(address(arbitrumLockboxAdapter), tokensToSend);

        // Execute OFT send
        vm.deal(userA, fee.nativeFee);
        vm.prank(userA);
        arbitrumLockboxAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(userA));

        // Check that total supply remains unchanged (tokens are locked, not burned)
        assertEq(IERC20(GMX_ARBITRUM).totalSupply(), initialTotalSupply);
        assertEq(IERC20(GMX_ARBITRUM).balanceOf(address(arbitrumLockboxAdapter)), tokensToSend);
        assertEq(IERC20(GMX_ARBITRUM).balanceOf(userA), INITIAL_BALANCE - tokensToSend);
    }

    function test_avalanche_mintburn_send_total_supply_changes() public {
        vm.selectFork(1); // Avalanche fork

        // Record initial total supply on Avalanche
        uint256 initialTotalSupply = IERC20(GMX_AVALANCHE).totalSupply();
        uint256 tokensToSend = 3 ether;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);
        SendParam memory sendParam = SendParam({
            dstEid: ARBITRUM_EID,
            to: userB.addressToBytes32(),
            amountLD: tokensToSend,
            minAmountLD: tokensToSend,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        // Get fee (no approval needed for mint/burn)
        MessagingFee memory fee = avalancheMintBurnAdapter.quoteSend(sendParam, false);

        // Execute OFT send
        vm.deal(userA, fee.nativeFee);
        vm.prank(userA);
        (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) = avalancheMintBurnAdapter.send{
            value: fee.nativeFee
        }(sendParam, fee, payable(userA));

        // Verify the send results
        assertEq(oftReceipt.amountSentLD, tokensToSend);
        assertEq(oftReceipt.amountReceivedLD, tokensToSend);
        assertNotEq(msgReceipt.guid, bytes32(0));

        // Check that total supply DECREASES (tokens are burned, not locked)
        assertEq(IERC20(GMX_AVALANCHE).totalSupply(), initialTotalSupply - tokensToSend);
        assertEq(IERC20(GMX_AVALANCHE).balanceOf(userA), INITIAL_BALANCE - tokensToSend);
    }
}
