// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IT402UptoRouter
/// @notice Interface for the T402 Up-To scheme router contract
/// @dev Enables usage-based billing by allowing settlement of any amount up to the permitted maximum
interface IT402UptoRouter {
    /// @notice Emitted when a transfer is executed
    /// @param token The ERC20 token address
    /// @param from The payer address
    /// @param to The recipient address
    /// @param settledAmount The actual amount transferred
    /// @param maxAmount The maximum authorized amount
    event TransferExecuted(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 settledAmount,
        uint256 maxAmount
    );

    /// @notice Emitted when a facilitator is added
    /// @param facilitator The facilitator address
    event FacilitatorAdded(address indexed facilitator);

    /// @notice Emitted when a facilitator is removed
    /// @param facilitator The facilitator address
    event FacilitatorRemoved(address indexed facilitator);

    /// @notice Execute a permitted transfer up to the approved amount
    /// @param token The ERC20 token address (must support EIP-2612)
    /// @param from The payer address (permit owner)
    /// @param to The recipient address
    /// @param maxAmount Maximum authorized amount (from permit)
    /// @param settleAmount Actual amount to transfer (must be <= maxAmount)
    /// @param deadline Permit deadline timestamp
    /// @param v Permit signature v component
    /// @param r Permit signature r component
    /// @param s Permit signature s component
    /// @dev Calls permit() then transferFrom() in a single transaction
    function executeUptoTransfer(
        address token,
        address from,
        address to,
        uint256 maxAmount,
        uint256 settleAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Check if an address is an authorized facilitator
    /// @param facilitator The address to check
    /// @return True if the address is an authorized facilitator
    function isFacilitator(address facilitator) external view returns (bool);

    /// @notice Add a new facilitator (owner only)
    /// @param facilitator The facilitator address to add
    function addFacilitator(address facilitator) external;

    /// @notice Remove a facilitator (owner only)
    /// @param facilitator The facilitator address to remove
    function removeFacilitator(address facilitator) external;
}
