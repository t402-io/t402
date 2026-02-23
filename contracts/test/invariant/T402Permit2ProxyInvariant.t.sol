// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { T402ExactPermit2Proxy } from "../../src/T402ExactPermit2Proxy.sol";
import { T402UptoPermit2Proxy } from "../../src/T402UptoPermit2Proxy.sol";
import { T402BasePermit2Proxy, IPermit2 } from "../../src/T402BasePermit2Proxy.sol";
import { MockPermit2 } from "../mocks/MockPermit2.sol";
import { MockERC20Permit } from "../mocks/MockERC20Permit.sol";

/// @title T402Permit2ProxyHandler
/// @notice Handler contract for invariant testing — performs random settle operations
contract T402Permit2ProxyHandler is Test {
    T402ExactPermit2Proxy public exactProxy;
    T402UptoPermit2Proxy public uptoProxy;
    MockPermit2 public permit2;
    MockERC20Permit public token;

    address public facilitator;
    uint256 public facilitatorKey;
    address public payer;
    uint256 public payerKey;
    address public recipient;

    uint256 public totalSettledToRecipient;
    uint256 public totalDeductedFromPayer;
    uint256 public settleCount;
    uint256 private _nextNonce;

    // Permit2 EIP-712 constants
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant _NAME_HASH = keccak256("Permit2");

    bytes32 private constant _PERMIT_WITNESS_TRANSFER_FROM_TYPEHASH = keccak256(
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)"
    );

    bytes32 private constant _TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    bytes32 private constant _WITNESS_TYPEHASH =
        keccak256("Witness(address to,address facilitator,uint256 validAfter)");

    constructor(
        T402ExactPermit2Proxy _exactProxy,
        T402UptoPermit2Proxy _uptoProxy,
        MockPermit2 _permit2,
        MockERC20Permit _token,
        address _facilitator,
        uint256 _facilitatorKey,
        address _payer,
        uint256 _payerKey,
        address _recipient
    ) {
        exactProxy = _exactProxy;
        uptoProxy = _uptoProxy;
        permit2 = _permit2;
        token = _token;
        facilitator = _facilitator;
        facilitatorKey = _facilitatorKey;
        payer = _payer;
        payerKey = _payerKey;
        recipient = _recipient;
    }

    /// @notice Settle an exact amount via the exact proxy
    function settleExact(uint256 amount) external {
        amount = bound(amount, 1, 10_000e6);

        // Ensure payer has enough balance
        if (token.balanceOf(payer) < amount) return;

        uint256 nonce = _nextNonce++;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: amount }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        vm.prank(facilitator);
        exactProxy.settle(permit, payer, witness, sig);

        totalSettledToRecipient += amount;
        totalDeductedFromPayer += amount;
        settleCount++;
    }

    /// @notice Settle a partial amount via the upto proxy
    function settleUpto(uint256 maxAmount, uint256 settleAmount) external {
        maxAmount = bound(maxAmount, 1, 10_000e6);
        settleAmount = bound(settleAmount, 1, maxAmount);

        // Ensure payer has enough balance
        if (token.balanceOf(payer) < settleAmount) return;

        uint256 nonce = _nextNonce++;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: maxAmount }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(uptoProxy), witness);

        vm.prank(facilitator);
        uptoProxy.settle(permit, settleAmount, payer, witness, sig);

        totalSettledToRecipient += settleAmount;
        totalDeductedFromPayer += settleAmount;
        settleCount++;
    }

    /// @notice Attempt settle with unauthorized caller (should revert)
    function settleUnauthorized(uint256 amount) external {
        amount = bound(amount, 1, 10_000e6);

        if (token.balanceOf(payer) < amount) return;

        uint256 nonce = _nextNonce++;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: amount }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        // Call from a random address that is NOT the facilitator
        address attacker = address(uint160(uint256(keccak256(abi.encode(nonce, "attacker")))));
        vm.prank(attacker);
        try exactProxy.settle(permit, payer, witness, sig) {
            // Should never succeed — if it does, the invariant test will catch it
            revert("unauthorized settle should not succeed");
        } catch {
            // Expected: revert with UnauthorizedFacilitator
        }
    }

    function _signPermitWitnessTransfer(
        uint256 signerKey,
        IPermit2.PermitTransferFrom memory permit,
        address spender,
        T402BasePermit2Proxy.Witness memory witness
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(_DOMAIN_TYPEHASH, _NAME_HASH, block.chainid, address(permit2))
        );

        bytes32 witnessHash = keccak256(
            abi.encode(_WITNESS_TYPEHASH, witness.to, witness.facilitator, witness.validAfter)
        );

        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(_TOKEN_PERMISSIONS_TYPEHASH, permit.permitted.token, permit.permitted.amount)
        );

        bytes32 structHash = keccak256(
            abi.encode(
                _PERMIT_WITNESS_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                spender,
                permit.nonce,
                permit.deadline,
                witnessHash
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}

/// @title T402Permit2ProxyInvariantTest
/// @notice Invariant tests for T402 Permit2 proxy contracts
contract T402Permit2ProxyInvariantTest is StdInvariant, Test {
    T402ExactPermit2Proxy public exactProxy;
    T402UptoPermit2Proxy public uptoProxy;
    MockPermit2 public permit2;
    MockERC20Permit public token;
    T402Permit2ProxyHandler public handler;

    address public facilitator;
    uint256 public facilitatorKey;
    address public payer;
    uint256 public payerKey;
    address public recipient;

    uint256 constant INITIAL_PAYER_BALANCE = 1_000_000e6; // 1M tokens

    function setUp() public {
        // Create accounts
        (facilitator, facilitatorKey) = makeAddrAndKey("facilitator");
        (payer, payerKey) = makeAddrAndKey("payer");
        recipient = makeAddr("recipient");

        // Deploy contracts
        permit2 = new MockPermit2();
        exactProxy = new T402ExactPermit2Proxy(address(permit2));
        uptoProxy = new T402UptoPermit2Proxy(address(permit2));
        token = new MockERC20Permit("USDT0", "USDT0", 6);

        // Fund payer and approve Permit2
        token.mint(payer, INITIAL_PAYER_BALANCE);
        vm.prank(payer);
        token.approve(address(permit2), type(uint256).max);

        // Deploy handler
        handler = new T402Permit2ProxyHandler(
            exactProxy,
            uptoProxy,
            permit2,
            token,
            facilitator,
            facilitatorKey,
            payer,
            payerKey,
            recipient
        );

        // Target only the handler for invariant calls
        targetContract(address(handler));

        // Target specific functions
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = T402Permit2ProxyHandler.settleExact.selector;
        selectors[1] = T402Permit2ProxyHandler.settleUpto.selector;
        selectors[2] = T402Permit2ProxyHandler.settleUnauthorized.selector;
        targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
    }

    /*//////////////////////////////////////////////////////////////
                         INVARIANT: NO TOKEN RETENTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Proxy contracts must never hold any tokens
    function invariant_proxiesNeverHoldTokens() public view {
        assertEq(
            token.balanceOf(address(exactProxy)),
            0,
            "exact proxy must never hold tokens"
        );
        assertEq(
            token.balanceOf(address(uptoProxy)),
            0,
            "upto proxy must never hold tokens"
        );
    }

    /*//////////////////////////////////////////////////////////////
                      INVARIANT: CONSERVATION OF FUNDS
    //////////////////////////////////////////////////////////////*/

    /// @notice Total supply must remain constant (no tokens created or destroyed)
    function invariant_totalSupplyConserved() public view {
        assertEq(
            token.totalSupply(),
            INITIAL_PAYER_BALANCE,
            "total supply must not change"
        );
    }

    /// @notice Funds deducted from payer must equal funds received by recipient
    function invariant_fundsConservation() public view {
        uint256 payerBalance = token.balanceOf(payer);
        uint256 recipientBalance = token.balanceOf(recipient);

        // payer started with INITIAL_PAYER_BALANCE, recipient with 0
        // Every token deducted from payer goes to recipient
        assertEq(
            INITIAL_PAYER_BALANCE - payerBalance,
            recipientBalance,
            "payer deductions must equal recipient receipts"
        );
    }

    /// @notice Handler tracking must match actual balances
    function invariant_handlerTrackingMatchesBalances() public view {
        assertEq(
            token.balanceOf(recipient),
            handler.totalSettledToRecipient(),
            "handler tracking must match recipient balance"
        );
        assertEq(
            INITIAL_PAYER_BALANCE - token.balanceOf(payer),
            handler.totalDeductedFromPayer(),
            "handler tracking must match payer deductions"
        );
    }

    /*//////////////////////////////////////////////////////////////
                 INVARIANT: SETTLEMENT AMOUNT CONSISTENCY
    //////////////////////////////////////////////////////////////*/

    /// @notice Payer balance must always be non-negative (handled by Solidity, but explicit)
    function invariant_payerBalanceNonNegative() public view {
        assertTrue(
            token.balanceOf(payer) <= INITIAL_PAYER_BALANCE,
            "payer balance must not exceed initial"
        );
    }

    /// @notice Log call summary for debugging
    function invariant_callSummary() public view {
        // This invariant always passes — used for logging
        if (handler.settleCount() > 0) {
            // Invariant holds: at least one settlement occurred
        }
    }
}
