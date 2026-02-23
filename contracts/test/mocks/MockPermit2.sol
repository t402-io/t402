// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { IPermit2 } from "../../src/interfaces/IPermit2.sol";
import { IERC20Permit } from "../../src/interfaces/IERC20Permit.sol";

/// @title MockPermit2
/// @notice Mock of Uniswap Permit2 for unit testing
/// @dev Implements permitWitnessTransferFrom with EIP-712 signature verification
contract MockPermit2 is IPermit2 {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant _NAME_HASH = keccak256("Permit2");

    bytes32 private constant _PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)"
    );

    bytes32 private constant _TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Bitmap of used nonces per owner — nonces[owner][wordPos] & (1 << bitPos)
    mapping(address => mapping(uint256 => uint256)) public nonceBitmap;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidSigner();
    error InvalidNonce();
    error SignatureExpired(uint256 deadline);

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Standard permitTransferFrom (without witness) — not used by proxy, stub only
    function permitTransferFrom(
        PermitTransferFrom calldata,
        SignatureTransferDetails calldata,
        address,
        bytes calldata
    ) external pure {
        revert("MockPermit2: use permitWitnessTransferFrom");
    }

    /// @notice Witness-based permitTransferFrom — the core function used by T402 proxies
    function permitWitnessTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata,
        bytes calldata signature
    ) external {
        // Check deadline
        if (block.timestamp > permit.deadline) {
            revert SignatureExpired(permit.deadline);
        }

        // Consume nonce (bitmap-based)
        _useNonce(owner, permit.nonce);

        // Verify signature
        bytes32 digest = _hashPermitWitnessTransferFrom(permit, msg.sender, witness);
        address signer = _recoverSigner(digest, signature);
        if (signer != owner) revert InvalidSigner();

        // Execute the transfer: owner → transferDetails.to
        // Permit2 enforces requestedAmount <= permitted.amount
        require(
            transferDetails.requestedAmount <= permit.permitted.amount,
            "TRANSFER_AMOUNT_EXCEEDS_PERMITTED"
        );
        IERC20Permit(permit.permitted.token)
            .transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _useNonce(address owner, uint256 nonce) internal {
        uint256 wordPos = nonce >> 8;
        uint256 bitPos = nonce & 0xff;
        uint256 bit = 1 << bitPos;

        uint256 word = nonceBitmap[owner][wordPos];
        if (word & bit != 0) revert InvalidNonce();
        nonceBitmap[owner][wordPos] = word | bit;
    }

    function _hashPermitWitnessTransferFrom(
        PermitTransferFrom calldata permit,
        address spender,
        bytes32 witness
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(_DOMAIN_TYPEHASH, _NAME_HASH, block.chainid, address(this))
        );

        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(_TOKEN_PERMISSIONS_TYPEHASH, permit.permitted.token, permit.permitted.amount)
        );

        bytes32 structHash = keccak256(
            abi.encode(
                _PERMIT_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                spender,
                permit.nonce,
                permit.deadline,
                witness
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature)
        internal
        pure
        returns (address)
    {
        require(signature.length == 65, "INVALID_SIG_LENGTH");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        return ecrecover(digest, v, r, s);
    }
}
