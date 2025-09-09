// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { OFTMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTMsgCodec.sol";

import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import { Origin, SendParam, MessagingFee, MessagingReceipt, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";

import { MintBurnOFTAdapter } from "@layerzerolabs/oft-evm/contracts/MintBurnOFTAdapter.sol";
import { Fee } from "@layerzerolabs/oft-evm/contracts/Fee.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

import { IOverridableInboundRatelimit, RateLimitExemptAddress } from "./interfaces/IOverridableInboundRatelimit.sol";
import { IFeeWithOwner } from "./interfaces/IFeeWithOwner.sol";

/**
 * @title MintBurnOFTAdapter Contract
 * @author LayerZero Labs (@shankars99)
 * @dev MintBurnOFTAdapter is a contract that adapts an ERC-20 token with external mint and burn logic to the OFT functionality.
 * @dev For existing ERC20 tokens with exposed mint and burn permissions, this can be used to convert the token to crosschain compatibility.
 * @dev Unlike the vanilla OFT Adapter, multiple of these can exist for a given global mesh.
 */
contract GMX_Adapter is MintBurnOFTAdapter, RateLimiter, Fee, IOverridableInboundRatelimit, IFeeWithOwner {
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for bytes32;

    mapping(address => bool) public exemptAddresses;
    mapping(bytes32 => bool) public guidOverrides;

    constructor(
        RateLimitConfig[] memory _rateLimitConfigs,
        address _token,
        IMintableBurnable _minterBurner,
        address _lzEndpoint,
        address _delegate
    ) MintBurnOFTAdapter(_token, _minterBurner, _lzEndpoint, _delegate) Ownable(_delegate) Fee() {
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
        emit RateLimitUpdated(_rateLimitConfigs);
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

        emit RateLimitOverrider_ModifiedAddress(_exemptAddresses);
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
        emit RateLimitOverrider_ModifiedGUID(_guids, _canOverride);
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
        /// @dev amountSentLD is amountLD with dust removed i.e. the amount being transferred.
        /// @dev amountReceivedLD is amountSentLD with fee, etc.
        /// amountSentLD = amountReceivedLD (sent crosschain) + fee (in contract) + dust (stays with user)
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);
        uint256 fee = amountSentLD - amountReceivedLD;

        /// @dev Burn and then mint to prevent supply overflows
        minterBurner.burn(_from, amountSentLD);

        /// @dev Fee amt accues in the contract and can be withdrawn by owner.
        if (fee > 0) minterBurner.mint(address(this), fee);

        /// @dev If the sender is an exemptAddress (FeeDistributor) then we do NOT refill the rate limiter.
        if (!exemptAddresses[msg.sender]) {
            /// @dev The original layerzero rate limiter is an outbound rate limit.
            /// @dev A unidirectional graph can be inverted by swapping the inflow and outflow functions.
            /// @dev This makes the rate limiter an inbound rate limit.
            super._inflow(_dstEid, amountReceivedLD);
        }
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

        /// @dev If the address is exempt or the GUID is overridable, skip the rate limit check else apply the rate limit.
        if (!exemptAddresses[toAddress] && !guidOverrides[_guid]) {
            /// @dev The original layerzero rate limiter is an outbound rate limit.
            /// @dev Switching `inflow` and `outflow` makes the rate limiter an inbound rate limit.
            super._outflow(_origin.srcEid, _toLD(_message.amountSD()));
        }

        super._lzReceive(_origin, _guid, _message, _executor, _extraData);
    }

    /**
     * @dev Internal function to mock the amount mutation from a OFT debit() operation.
     * @param _amountLD The amount to send in local decimals.
     * @param _minAmountLD The minimum amount to send in local decimals.
     * @dev _dstEid The destination endpoint ID.
     * @return amountSentLD The amount sent, in local decimals.
     * @return amountReceivedLD The amount to be received on the remote chain, in local decimals.
     *
     * @dev This is where things like fees would be calculated and deducted from the amount to be received on the remote.
     */
    function _debitView(
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal view virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        /// @dev Apply the fee on the amount being transferred, then remove dust from `amount - fee`.
        uint256 fee = getFee(_dstEid, _removeDust(_amountLD));

        /// @dev Use `_amountLD` instead of `_removeDust(_amountLD)` because:
        /// @dev _removeDust(_removeDust(_amountLD) - fee) <= _removeDust(_amountLD - fee) <= amountSentLD
        /// @dev amt = 106, dust = decimal 1.
        /// @dev preDust = _removeDust(100 - 1) = 90
        /// @dev noDust = _removeDust(106 - 1) = 100
        amountReceivedLD = _removeDust(_amountLD - fee);

        /// @dev The amount to burn is the amount being transferred plus the fee.
        /// @dev (100+1) is the burn amount and the dust is 4.
        amountSentLD = fee + amountReceivedLD;

        /// @dev Check for slippage.
        if (amountReceivedLD < _minAmountLD) {
            revert SlippageExceeded(amountReceivedLD, _minAmountLD);
        }
    }

    /**
     * @notice Withdraw the fee from the contract.
     * @dev Since this is a MintBurn OFT Adapter the contract's balance is ALWAYS the fee amount.
     * @dev Callable by owner, this supports withdrawing to a target address.
     * @dev Withdraw amounts are capped at the fee amount in the contract.
     * @param _to The address to withdraw the fee to.
     * @param _amount The amount to withdraw.
     */
    function withdrawFee(address _to, uint256 _amount) external virtual onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();

        /// @dev If this is a lockbox adapter then we need to track the fee amount in the contract.
        uint256 totalFee = innerToken.balanceOf(address(this));
        if (_amount > totalFee) revert ExceedsFeeAccrued(_amount, totalFee);

        innerToken.transfer(_to, _amount);
        emit FeeWithdrawn(_to, _amount);
    }
}
