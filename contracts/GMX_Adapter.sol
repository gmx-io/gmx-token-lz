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
     * @notice Override the base send() function to include _outflow() before sending the message.
     * @dev This function is called when a message is sent to another chain.
     * @param _sendParam The parameters for sending the message.
     * @param _fee The fee for sending the message.
     * @param _refundAddress The address to refund any excess fee.
     * @return msgReceipt The receipt of the message sent.
     * @return oftReceipt The receipt of the OFT sent.
     */
    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable override returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        _outflow(_sendParam.dstEid, _sendParam.amountLD);

        return _send(_sendParam, _fee, _refundAddress);
    }

    /**
     * @notice Override the base _lzReceive() function to include use _overridableCredit() instead of _credit().
     * @dev This function is called when a message is received from another chain.
     * @param _origin The origin of the message.
     * @param _guid The GUID of the message.
     * @param _message The message data.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/, // @dev unused in the default implementation.
        bytes calldata /*_extraData*/ // @dev unused in the default implementation.
    ) internal virtual override {
        address toAddress = _message.sendTo().bytes32ToAddress();

        /// @dev Original impl uses _credit() which does not take in guid. We need guid for guid based overrides.
        uint256 amountReceivedLD = _overridableCredit(_guid, toAddress, _toLD(_message.amountSD()), _origin.srcEid);

        if (_message.isComposed()) {
            bytes memory composeMsg = OFTComposeMsgCodec.encode(
                _origin.nonce,
                _origin.srcEid,
                amountReceivedLD,
                _message.composeMsg()
            );

            endpoint.sendCompose(toAddress, _guid, 0 /* the index of the composed message*/, composeMsg);
        }

        emit OFTReceived(_guid, _origin.srcEid, toAddress, amountReceivedLD);
    }

    /**
     * @notice New function that wraps _credit() with the overridable logic and adds in the guid.
     * @param _guid The GUID for the message.
     * @param _to The address to credit the tokens to.
     * @param _amountLD The amount of tokens to credit in local denomination.
     * @param _srcEid The source endpoint ID.
     * @return amountReceivedLD The amount of tokens received in local denomination.
     * @dev This function is called when tokens are sent out of the contract.
     */
    function _overridableCredit(
        bytes32 _guid,
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual returns (uint256 amountReceivedLD) {
        _inflowOverridable(_guid, _to, _amountLD, _srcEid);

        return _credit(_to, _amountLD, _srcEid);
    }
}
