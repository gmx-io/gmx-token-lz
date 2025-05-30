// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MintBurnOFTAdapter } from "@layerzerolabs/oft-evm/contracts/MintBurnOFTAdapter.sol";
import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";
import { SendParam, MessagingFee, MessagingReceipt, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";
import { IGMX_Adapter } from "./interfaces/IGMX_Adapter.sol";

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
contract GMX_Adapter is MintBurnOFTAdapter, RateLimiter, IGMX_Adapter {
    mapping(bytes32 => bool) public canOverrideRateLimit;

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
     * @dev Adds an address to the list of addresses that can override the rate limit.
     * @dev To be used for EVM chains where the address is not bytes32.
     * @param _address The address to add to the list.
     * @param _canOverride Whether the address can override the rate limit.
     */
    function modifyRateLimitOverrideList(address _address, bool _canOverride) external onlyOwner {
        canOverrideRateLimit[_addressToBytes32(_address)] = _canOverride;

        emit NewRateLimitOverrider(_addressToBytes32(_address));
    }

    /**
     * @dev Adds an address to the list of addresses that can override the rate limit.
     * @dev To be used for non-EVM chains where the address is bytes32.
     * @param _address The address to add to the list.
     * @param _canOverride Whether the address can override the rate limit.
     */
    function modifyRateLimitOverrideList(bytes32 _address, bool _canOverride) external onlyOwner {
        canOverrideRateLimit[_address] = _canOverride;

        emit NewRateLimitOverrider(_address);
    }

    /**
     * @dev Sets the rate limits based on RateLimitConfig array. Only callable by the owner or the rate limiter.
     * @param _rateLimitConfigs An array of RateLimitConfig structures defining the rate limits.
     */
    function setRateLimits(RateLimitConfig[] calldata _rateLimitConfigs) external onlyOwner {
        _setRateLimits(_rateLimitConfigs);

        emit RateLimitUpdated(_rateLimitConfigs);
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
        if (canOverrideRateLimit[bytes32(_sendParam.to)]) {
            emit RateLimitOverrided(bytes32(_sendParam.to), _sendParam.amountLD);
        } else {
            _outflow(_sendParam.dstEid, _sendParam.amountLD);
        }
        return _send(_sendParam, _fee, _refundAddress);
    }

    /**
     * @dev Overrides the _credit function to allow for rate limit override.
     * @param _to The address to credit.
     * @param _amountLD The amount to credit in local decimals.
     * @param _srcEid The source endpoint ID.
     * @return amountReceivedLD The amount received in local decimals.
     */
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual override returns (uint256 amountReceivedLD) {
        if (canOverrideRateLimit[_addressToBytes32(_to)]) {
            emit RateLimitOverrided(_addressToBytes32(_to), _amountLD);
        } else {
            _inflow(_srcEid, _amountLD);
        }

        return super._credit(_to, _amountLD, _srcEid);
    }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }
}
