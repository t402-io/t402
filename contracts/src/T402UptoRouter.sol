// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IT402UptoRouter} from "./interfaces/IT402UptoRouter.sol";
import {IERC20Permit} from "./interfaces/IERC20Permit.sol";

/// @title T402UptoRouter
/// @notice Router contract for T402 Up-To scheme payments
/// @dev Enables usage-based billing by combining EIP-2612 permit with flexible settlement amounts
/// @custom:security-contact security@t402.io
contract T402UptoRouter is IT402UptoRouter {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when settle amount exceeds max amount
    error SettleAmountExceedsMax(uint256 settleAmount, uint256 maxAmount);

    /// @notice Thrown when caller is not an authorized facilitator
    error UnauthorizedFacilitator(address caller);

    /// @notice Thrown when caller is not the owner
    error UnauthorizedOwner(address caller);

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when amount is zero
    error ZeroAmount();

    /// @notice Thrown when permit deadline has passed
    error PermitExpired(uint256 deadline, uint256 currentTime);

    /// @notice Thrown when transfer fails
    error TransferFailed();

    /// @notice Thrown when facilitator already exists
    error FacilitatorAlreadyExists(address facilitator);

    /// @notice Thrown when facilitator does not exist
    error FacilitatorDoesNotExist(address facilitator);

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Contract owner
    address public immutable owner;

    /// @notice Mapping of authorized facilitators
    mapping(address => bool) private _facilitators;

    /// @notice Number of authorized facilitators
    uint256 public facilitatorCount;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy the router with initial facilitator
    /// @param initialFacilitator The initial facilitator address
    constructor(address initialFacilitator) {
        if (initialFacilitator == address(0)) revert ZeroAddress();

        owner = msg.sender;
        _facilitators[initialFacilitator] = true;
        facilitatorCount = 1;

        emit FacilitatorAdded(initialFacilitator);
    }

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Restrict to authorized facilitators
    modifier onlyFacilitator() {
        if (!_facilitators[msg.sender]) {
            revert UnauthorizedFacilitator(msg.sender);
        }
        _;
    }

    /// @notice Restrict to owner
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert UnauthorizedOwner(msg.sender);
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IT402UptoRouter
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
    ) external onlyFacilitator {
        // Validate inputs
        if (token == address(0) || from == address(0) || to == address(0)) {
            revert ZeroAddress();
        }
        if (settleAmount == 0) {
            revert ZeroAmount();
        }
        if (settleAmount > maxAmount) {
            revert SettleAmountExceedsMax(settleAmount, maxAmount);
        }
        if (block.timestamp > deadline) {
            revert PermitExpired(deadline, block.timestamp);
        }

        // Execute permit to approve this contract for maxAmount
        // The permit authorizes `address(this)` as the spender
        IERC20Permit(token).permit(from, address(this), maxAmount, deadline, v, r, s);

        // Transfer only the settled amount (which may be less than maxAmount)
        bool success = IERC20Permit(token).transferFrom(from, to, settleAmount);
        if (!success) {
            revert TransferFailed();
        }

        emit TransferExecuted(token, from, to, settleAmount, maxAmount);
    }

    /*//////////////////////////////////////////////////////////////
                         FACILITATOR MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IT402UptoRouter
    function isFacilitator(address facilitator) external view returns (bool) {
        return _facilitators[facilitator];
    }

    /// @inheritdoc IT402UptoRouter
    function addFacilitator(address facilitator) external onlyOwner {
        if (facilitator == address(0)) revert ZeroAddress();
        if (_facilitators[facilitator]) revert FacilitatorAlreadyExists(facilitator);

        _facilitators[facilitator] = true;
        unchecked {
            facilitatorCount++;
        }

        emit FacilitatorAdded(facilitator);
    }

    /// @inheritdoc IT402UptoRouter
    function removeFacilitator(address facilitator) external onlyOwner {
        if (!_facilitators[facilitator]) revert FacilitatorDoesNotExist(facilitator);

        _facilitators[facilitator] = false;
        unchecked {
            facilitatorCount--;
        }

        emit FacilitatorRemoved(facilitator);
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if a permit would be valid
    /// @param token The token address
    /// @param from The payer address
    /// @param maxAmount The max amount to permit
    /// @return valid True if the payer has sufficient balance
    /// @return balance The payer's current balance
    function checkPermitValidity(
        address token,
        address from,
        uint256 maxAmount
    ) external view returns (bool valid, uint256 balance) {
        balance = IERC20Permit(token).balanceOf(from);
        valid = balance >= maxAmount;
    }

    /// @notice Get the current nonce for permit signing
    /// @param token The token address
    /// @param owner The permit owner
    /// @return The current nonce
    function getPermitNonce(address token, address owner) external view returns (uint256) {
        return IERC20Permit(token).nonces(owner);
    }

    /// @notice Get the domain separator for a token
    /// @param token The token address
    /// @return The domain separator
    function getDomainSeparator(address token) external view returns (bytes32) {
        return IERC20Permit(token).DOMAIN_SEPARATOR();
    }
}
