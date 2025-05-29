// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MintBurnOFTAdapter } from "@layerzerolabs/oft-evm/contracts/MintBurnOFTAdapter.sol";
import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";
import { SendParam, MessagingFee, MessagingReceipt, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";

/**
 * @title MintBurnOFTAdapter Contract
 * @dev MintBurnOFTAdapter is a contract that adapts an ERC-20 token with external mint and burn logic to the OFT functionality.
 *
 * @dev For existing ERC20 tokens with exposed mint and burn permissions, this can be used to convert the token to crosschain compatibility.
 * @dev Unlike the vanilla OFT Adapter, multiple of these can exist for a given global mesh.
 * @dev WARNING: The default OFTAdapter implementation assumes LOSSLESS transfers, ie. 1 token in, 1 token out.
 * IF the 'innerToken' applies something like a transfer fee, the default will NOT work...
 * a pre/post balance check will need to be done to calculate the amountSentLD/amountReceivedLD.
 */
contract GMX_Adapter is MintBurnOFTAdapter, RateLimiter {
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
     * @dev Sets the rate limits based on RateLimitConfig array. Only callable by the owner or the rate limiter.
     * @param _rateLimitConfigs An array of RateLimitConfig structures defining the rate limits.
     */
    function setRateLimits(RateLimitConfig[] calldata _rateLimitConfigs) external onlyOwner {
        _setRateLimits(_rateLimitConfigs);
    }

    /**
     * @dev Sends a message to the destination chain while updating the rate limit.
     * @param _sendParam The parameters for the message.
     * @param _fee The fee for the message.
     * @param _refundAddress The address to refund the fee to.
     * @return msgReceipt The receipt of the message.
     * @return oftReceipt The receipt of the OFT.
     */
    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable override returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        _outflow(_sendParam.dstEid, _sendParam.amountLD); // updating the rate limit per message sent
        return _send(_sendParam, _fee, _refundAddress);
    }
}
