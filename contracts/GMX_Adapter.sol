// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MintBurnOFTAdapter } from "@layerzerolabs/oft-evm/contracts/MintBurnOFTAdapter.sol";
import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import { SendParam, MessagingFee, MessagingReceipt, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";
import { Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OFTMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTMsgCodec.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";
import { OverridableInboundRateLimiter } from "./OverridableInboundRateLimiter.sol";

/**
 * @title MintBurnOFTAdapter Contract
 * @author LayerZero Labs (@shankars99)
 * @dev MintBurnOFTAdapter is a contract that adapts an ERC-20 token with external mint and burn logic to the OFT functionality.
 * @dev For existing ERC20 tokens with exposed mint and burn permissions, this can be used to convert the token to crosschain compatibility.
 * @dev Unlike the vanilla OFT Adapter, multiple of these can exist for a given global mesh.
 */
contract GMX_Adapter is MintBurnOFTAdapter, OverridableInboundRateLimiter {
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for bytes32;

    constructor(
        RateLimitConfig[] memory _rateLimitConfigs,
        address _token,
        IMintableBurnable _minterBurner,
        address _lzEndpoint,
        address _delegate
    ) MintBurnOFTAdapter(_token, _minterBurner, _lzEndpoint, _delegate) Ownable(_delegate) {
        _setRateLimits(_rateLimitConfigs);
    }

    /**
     * @notice Override the base _debit() function to consume rate limit before super._debit()
     * @dev This function is called when a debit is made from the OFT.
     * @param _from The address from which the debit is made.
     * @param _amountLD The amount to debit in local denomination.
     * @param _minAmountLD The minimum amount to debit in local denomination.
     * @param _dstEid The destination endpoint ID.
     */
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        /// @dev The original layerzero rate limiter is an outbound rate limit.
        /// @dev A unidirectional graph can be inverted by swapping the inflow and outflow functions.
        /// @dev This makes the rate limiter an inbound rate limit.
        super._inflow(_dstEid, _amountLD);

        return super._debit(_from, _amountLD, _minAmountLD, _dstEid);
    }

    /**
     * @notice Override the base _lzReceive() function to use _inflowOverridable() before super._lzReceive()
     * @dev This function is called when a message is received from another chain.
     * @param _origin The origin of the message.
     * @param _guid The GUID of the message.
     * @param _message The message data.
     * @param _executor The address of the executor.
     * @param _extraData Additional data for the message.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor, // @dev unused in the default implementation.
        bytes calldata _extraData // @dev unused in the default implementation.
    ) internal virtual override {
        address toAddress = _message.sendTo().bytes32ToAddress();

        /// @dev The original layerzero rate limiter is an outbound rate limit.
        /// @dev A unidirectional graph can be inverted by swapping the inflow and outflow functions.
        /// @dev This makes the rate limiter an inbound rate limit.
        /// @dev If the address is exempt or the GUID is overridable, skip the rate limit check else apply the rate limit.
        _inflowOverridable(_guid, toAddress, _toLD(_message.amountSD()), _origin.srcEid);

        super._lzReceive(_origin, _guid, _message, _executor, _extraData);
    }
}
