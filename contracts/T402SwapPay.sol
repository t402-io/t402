// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

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

contract T402SwapPay {
    ISwapRouter public immutable swapRouter;

    event SwapAndPay(
        address indexed payer,
        address indexed payTo,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint24 poolFee
    );

    constructor(address _swapRouter) {
        swapRouter = ISwapRouter(_swapRouter);
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
        uint24 poolFee
    ) external returns (uint256 amountIn) {
        // Pull input tokens from payer
        IERC20(inputToken).transferFrom(payer, address(this), maxInputAmount);

        // Approve router to spend input tokens
        IERC20(inputToken).approve(address(swapRouter), maxInputAmount);

        // Swap exact output: get exactly outputAmount of outputToken
        amountIn = swapRouter.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: inputToken,
                tokenOut: outputToken,
                fee: poolFee,
                recipient: payTo, // Send directly to merchant
                amountOut: outputAmount,
                amountInMaximum: maxInputAmount,
                sqrtPriceLimitX96: 0
            })
        );

        // Refund excess input tokens to payer
        uint256 remaining = IERC20(inputToken).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(inputToken).transfer(payer, remaining);
        }

        emit SwapAndPay(payer, payTo, inputToken, outputToken, amountIn, outputAmount, poolFee);
    }
}
