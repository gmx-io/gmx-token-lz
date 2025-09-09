// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

interface IFeeWithOwner {
    error ZeroAmount();
    error ZeroAddress();
    error ExceedsFeeAccrued(uint256 requestedAmount, uint256 availableAmount);

    event FeeWithdrawn(address indexed to, uint256 amount);

    function withdrawFee(address to, uint256 _amount) external;
}
