// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { T402BasePermit2Proxy, IPermit2 } from "./T402BasePermit2Proxy.sol";

/// @title T402UptoPermit2Proxy
/// @notice Permit2 proxy for up-to (usage-based) settlement
/// @dev The facilitator specifies the actual settlement amount, which must be
///      <= the permitted amount. Useful for metered billing where the final
///      amount is determined at settlement time.
/// @custom:security-contact security@t402.io
contract T402UptoPermit2Proxy is T402BasePermit2Proxy {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when settlement amount exceeds the permitted maximum
    error AmountExceedsPermitted();

    /// @param permit2 Address of the Permit2 contract
    constructor(address permit2) T402BasePermit2Proxy(permit2) { }

    /// @notice Settle an up-to payment via Permit2
    /// @param permit Permit2 transfer parameters (permitted.amount = max)
    /// @param amount Actual settlement amount (must be <= permitted.amount)
    /// @param owner Token owner (payer)
    /// @param witness Witness data (to, facilitator, validAfter)
    /// @param signature Payer's EIP-712 signature
    function settle(
        IPermit2.PermitTransferFrom calldata permit,
        uint256 amount,
        address owner,
        Witness calldata witness,
        bytes calldata signature
    ) external nonReentrant {
        if (amount > permit.permitted.amount) revert AmountExceedsPermitted();
        _settle(permit, amount, owner, witness, signature);
    }

    /// @notice Settle with gasless EIP-2612 permit + Permit2
    /// @param permit2612 EIP-2612 permit to approve Permit2 as spender
    /// @param permit Permit2 transfer parameters (permitted.amount = max)
    /// @param amount Actual settlement amount (must be <= permitted.amount)
    /// @param owner Token owner (payer)
    /// @param witness Witness data (to, facilitator, validAfter)
    /// @param signature Payer's EIP-712 signature
    function settleWithPermit(
        EIP2612Permit calldata permit2612,
        IPermit2.PermitTransferFrom calldata permit,
        uint256 amount,
        address owner,
        Witness calldata witness,
        bytes calldata signature
    ) external nonReentrant {
        if (amount > permit.permitted.amount) revert AmountExceedsPermitted();
        _executePermit(permit.permitted.token, owner, permit2612, permit.permitted.amount);
        _settle(permit, amount, owner, witness, signature);
    }
}
