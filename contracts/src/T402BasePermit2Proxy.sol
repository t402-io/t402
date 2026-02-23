// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IPermit2 } from "./interfaces/IPermit2.sol";
import { IERC20Permit } from "./interfaces/IERC20Permit.sol";

/// @title T402BasePermit2Proxy
/// @notice Abstract base for T402 Permit2 proxy contracts
/// @dev Provides witness-based settlement via Uniswap Permit2 SignatureTransfer
///      with optional gasless EIP-2612 permit for token approval
/// @custom:security-contact security@t402.io
abstract contract T402BasePermit2Proxy is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    /// @notice Witness data bound into the payer's EIP-712 signature
    /// @param to Destination address for the token transfer
    /// @param facilitator Address authorized to call settle (must match msg.sender)
    /// @param validAfter Earliest timestamp when settlement is permitted
    struct Witness {
        address to;
        address facilitator;
        uint256 validAfter;
    }

    /// @notice EIP-2612 permit parameters for gasless token approval
    /// @param value Amount to approve (must match permitted amount)
    /// @param deadline Permit expiry timestamp
    /// @param v Recovery byte of the permit signature
    /// @param r First 32 bytes of the permit signature
    /// @param s Second 32 bytes of the permit signature
    struct EIP2612Permit {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidPermit2Address();
    error InvalidAmount();
    error InvalidOwner();
    error InvalidDestination();
    error UnauthorizedFacilitator();
    error PaymentTooEarly();
    error Permit2612AmountMismatch();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted on successful settlement
    event Settled(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        address facilitator
    );

    /// @notice Emitted when an optional EIP-2612 permit call fails (non-fatal)
    event EIP2612PermitFailed(address indexed token, address indexed owner, bytes reason);

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice EIP-712 typehash for the Witness struct
    bytes32 public constant WITNESS_TYPEHASH =
        keccak256("Witness(address to,address facilitator,uint256 validAfter)");

    /// @notice Witness type string for Permit2's permitWitnessTransferFrom
    /// @dev Format: "Witness witness)TokenPermissions(...)Witness(...)" — types listed alphabetically
    string public constant WITNESS_TYPE_STRING =
        "Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)";

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Canonical Uniswap Permit2 contract
    IPermit2 public immutable PERMIT2;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param permit2 Address of the Permit2 contract
    constructor(address permit2) {
        if (permit2 == address(0)) revert InvalidPermit2Address();
        PERMIT2 = IPermit2(permit2);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Core settlement: validate witness and execute via Permit2
    /// @param permit Permit2 transfer parameters (token, amount, nonce, deadline)
    /// @param settlementAmount Amount to actually transfer (may be <= permitted)
    /// @param owner Token owner (payer)
    /// @param witness Witness data bound in the payer's signature
    /// @param signature The payer's EIP-712 signature over PermitWitnessTransferFrom
    function _settle(
        IPermit2.PermitTransferFrom calldata permit,
        uint256 settlementAmount,
        address owner,
        Witness calldata witness,
        bytes calldata signature
    ) internal {
        // Validate inputs
        if (settlementAmount == 0) revert InvalidAmount();
        if (owner == address(0)) revert InvalidOwner();
        if (witness.to == address(0)) revert InvalidDestination();

        // Verify caller is the authorized facilitator
        if (msg.sender != witness.facilitator) revert UnauthorizedFacilitator();

        // Enforce lower time bound
        if (block.timestamp < witness.validAfter) revert PaymentTooEarly();

        // Construct transfer details with destination from witness
        IPermit2.SignatureTransferDetails memory transferDetails = IPermit2.SignatureTransferDetails({
            to: witness.to,
            requestedAmount: settlementAmount
        });

        // Reconstruct witness hash for Permit2 verification
        bytes32 witnessHash = keccak256(
            abi.encode(WITNESS_TYPEHASH, witness.to, witness.facilitator, witness.validAfter)
        );

        // Execute via Permit2 — verifies signature, checks nonce, transfers tokens
        PERMIT2.permitWitnessTransferFrom(
            permit, transferDetails, owner, witnessHash, WITNESS_TYPE_STRING, signature
        );

        emit Settled(permit.permitted.token, owner, witness.to, settlementAmount, msg.sender);
    }

    /// @notice Attempt EIP-2612 permit call (non-fatal on failure)
    /// @dev The permit may fail if: approval already exists, token doesn't support EIP-2612,
    ///      or the permit was already consumed. Failure is logged but does not block settlement.
    /// @param token ERC20 token address
    /// @param owner Token owner
    /// @param permit2612 EIP-2612 permit parameters
    /// @param permittedAmount Expected amount (must match permit2612.value)
    function _executePermit(
        address token,
        address owner,
        EIP2612Permit calldata permit2612,
        uint256 permittedAmount
    ) internal {
        // Hard revert if amounts don't match (pre-check before trying permit)
        if (permit2612.value != permittedAmount) revert Permit2612AmountMismatch();

        // Approve the Permit2 contract as spender via EIP-2612
        try IERC20Permit(token).permit(
            owner,
            address(PERMIT2),
            permit2612.value,
            permit2612.deadline,
            permit2612.v,
            permit2612.r,
            permit2612.s
        ) {
            // Success — Permit2 now has approval
        } catch (bytes memory reason) {
            emit EIP2612PermitFailed(token, owner, reason);
        }
    }
}
