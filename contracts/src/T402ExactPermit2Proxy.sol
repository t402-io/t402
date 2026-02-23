// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { T402BasePermit2Proxy, IPermit2 } from "./T402BasePermit2Proxy.sol";

/// @title T402ExactPermit2Proxy
/// @notice Permit2 proxy for exact-amount settlement
/// @dev Always transfers the full permitted amount. The settlement amount equals
///      permit.permitted.amount — analogous to EIP-3009 transferWithAuthorization.
/// @custom:security-contact security@t402.io
contract T402ExactPermit2Proxy is T402BasePermit2Proxy {
    /// @param permit2 Address of the Permit2 contract
    constructor(address permit2) T402BasePermit2Proxy(permit2) { }

    /// @notice Settle an exact payment via Permit2
    /// @param permit Permit2 transfer parameters
    /// @param owner Token owner (payer)
    /// @param witness Witness data (to, facilitator, validAfter)
    /// @param signature Payer's EIP-712 signature
    function settle(
        IPermit2.PermitTransferFrom calldata permit,
        address owner,
        Witness calldata witness,
        bytes calldata signature
    ) external nonReentrant {
        _settle(permit, permit.permitted.amount, owner, witness, signature);
    }

    /// @notice Settle with gasless EIP-2612 permit + Permit2
    /// @param permit2612 EIP-2612 permit to approve Permit2 as spender
    /// @param permit Permit2 transfer parameters
    /// @param owner Token owner (payer)
    /// @param witness Witness data (to, facilitator, validAfter)
    /// @param signature Payer's EIP-712 signature
    function settleWithPermit(
        EIP2612Permit calldata permit2612,
        IPermit2.PermitTransferFrom calldata permit,
        address owner,
        Witness calldata witness,
        bytes calldata signature
    ) external nonReentrant {
        _executePermit(permit.permitted.token, owner, permit2612, permit.permitted.amount);
        _settle(permit, permit.permitted.amount, owner, witness, signature);
    }
}
