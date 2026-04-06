// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title T402SwapPay
 * @notice Atomic swap-and-pay: payer sends any token, merchant receives stablecoins.
 *         Uses Uniswap V3 SwapRouter for token conversion.
 *
 * Flow:
 * 1. Payer approves this contract for inputToken
 * 2. Facilitator calls swapAndPay()
 * 3. Contract swaps inputToken → outputToken via Uniswap
 * 4. Contract transfers outputToken to merchant (payTo)
 * 5. Refunds any excess input tokens to payer
 */

interface ISwapRouter {
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        returns (uint256 amountIn);
}

contract T402SwapPay is ReentrancyGuard {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable swapRouter;
    address public immutable facilitator;

    error UnauthorizedCaller();
    error InvalidAddress();
    error InvalidAmount();

    event SwapAndPay(
        address indexed payer,
        address indexed payTo,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint24 poolFee
    );

    modifier onlyFacilitator() {
        if (msg.sender != facilitator) revert UnauthorizedCaller();
        _;
    }

    constructor(address _swapRouter, address _facilitator) {
        if (_swapRouter == address(0)) revert InvalidAddress();
        if (_facilitator == address(0)) revert InvalidAddress();
        swapRouter = ISwapRouter(_swapRouter);
        facilitator = _facilitator;
    }

    /**
     * @notice Swap input token to output token and pay merchant.
     * @param payer Address providing the input tokens
     * @param payTo Merchant address receiving output tokens
     * @param inputToken Token the payer is sending
     * @param outputToken Token the merchant wants (e.g., USDC)
     * @param outputAmount Exact amount merchant receives
     * @param maxInputAmount Maximum input tokens payer is willing to spend
     * @param poolFee Uniswap pool fee tier (500, 3000, or 10000)
     */
    function swapAndPay(
        address payer,
        address payTo,
        address inputToken,
        address outputToken,
        uint256 outputAmount,
        uint256 maxInputAmount,
        uint24 poolFee,
        uint160 sqrtPriceLimitX96
    ) external onlyFacilitator nonReentrant returns (uint256 amountIn) {
        if (payer == address(0) || payTo == address(0)) revert InvalidAddress();
        if (outputAmount == 0 || maxInputAmount == 0) revert InvalidAmount();

        // Pull input tokens from payer
        IERC20(inputToken).safeTransferFrom(payer, address(this), maxInputAmount);

        // Approve router to spend input tokens
        IERC20(inputToken).forceApprove(address(swapRouter), maxInputAmount);

        // Swap exact output: get exactly outputAmount of outputToken
        // sqrtPriceLimitX96 provides MEV/sandwich protection — caller should
        // compute from a TWAP oracle or off-chain price feed
        amountIn = swapRouter.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: inputToken,
                tokenOut: outputToken,
                fee: poolFee,
                recipient: payTo, // Send directly to merchant
                amountOut: outputAmount,
                amountInMaximum: maxInputAmount,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        // Reset approval to 0 after swap
        IERC20(inputToken).forceApprove(address(swapRouter), 0);

        // Refund excess input tokens to payer
        uint256 remaining = IERC20(inputToken).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(inputToken).safeTransfer(payer, remaining);
        }

        emit SwapAndPay(payer, payTo, inputToken, outputToken, amountIn, outputAmount, poolFee);
    }

    /// @notice Reject any ETH sent directly to the contract
    receive() external payable {
        revert("ETH not accepted");
    }
}
