// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { T402UptoPermit2Proxy } from "../src/T402UptoPermit2Proxy.sol";
import { T402BasePermit2Proxy, IPermit2 } from "../src/T402BasePermit2Proxy.sol";
import { MockPermit2 } from "./mocks/MockPermit2.sol";
import { MockERC20Permit } from "./mocks/MockERC20Permit.sol";

contract T402UptoPermit2ProxyTest is Test {
    T402UptoPermit2Proxy public proxy;
    MockPermit2 public permit2;
    MockERC20Permit public token;

    address public facilitator;
    uint256 public facilitatorKey;
    address public payer;
    uint256 public payerKey;
    address public recipient;

    uint256 constant MAX_AMOUNT = 1000e6;
    uint256 constant SETTLE_AMOUNT = 750e6;

    function setUp() public {
        (facilitator, facilitatorKey) = makeAddrAndKey("facilitator");
        (payer, payerKey) = makeAddrAndKey("payer");
        recipient = makeAddr("recipient");

        permit2 = new MockPermit2();
        proxy = new T402UptoPermit2Proxy(address(permit2));
        token = new MockERC20Permit("USDT0", "USDT0", 6);

        token.mint(payer, 10_000e6);
        vm.prank(payer);
        token.approve(address(permit2), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                            SETTLE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_settle_partialAmount() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        uint256 payerBefore = token.balanceOf(payer);

        vm.prank(facilitator);
        proxy.settle(permit, SETTLE_AMOUNT, payer, witness, sig);

        assertEq(token.balanceOf(payer), payerBefore - SETTLE_AMOUNT);
        assertEq(token.balanceOf(recipient), SETTLE_AMOUNT);
    }

    function test_settle_fullAmount() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        proxy.settle(permit, MAX_AMOUNT, payer, witness, sig);

        assertEq(token.balanceOf(recipient), MAX_AMOUNT);
    }

    function test_settle_revertsOnAmountExceedsPermitted() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402UptoPermit2Proxy.AmountExceedsPermitted.selector);
        proxy.settle(permit, MAX_AMOUNT + 1, payer, witness, sig);
    }

    function test_settle_revertsOnZeroAmount() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402BasePermit2Proxy.InvalidAmount.selector);
        proxy.settle(permit, 0, payer, witness, sig);
    }

    function test_settle_revertsOnUnauthorizedFacilitator() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(T402BasePermit2Proxy.UnauthorizedFacilitator.selector);
        proxy.settle(permit, SETTLE_AMOUNT, payer, witness, sig);
    }

    function test_settle_emitsEvent() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.expectEmit(true, true, true, true);
        emit T402BasePermit2Proxy.Settled(
            address(token), payer, recipient, SETTLE_AMOUNT, facilitator
        );

        vm.prank(facilitator);
        proxy.settle(permit, SETTLE_AMOUNT, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                      SETTLE WITH PERMIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_settleWithPermit_success() public {
        uint256 deadline = block.timestamp + 3600;

        (address freshPayer, uint256 freshPayerKey) = makeAddrAndKey("freshPayer");
        token.mint(freshPayer, 10_000e6);

        T402BasePermit2Proxy.EIP2612Permit memory permit2612 =
            _signEIP2612Permit(freshPayerKey, freshPayer, address(permit2), MAX_AMOUNT, deadline);

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(freshPayerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        proxy.settleWithPermit(permit2612, permit, SETTLE_AMOUNT, freshPayer, witness, sig);

        assertEq(token.balanceOf(freshPayer), 10_000e6 - SETTLE_AMOUNT);
        assertEq(token.balanceOf(recipient), SETTLE_AMOUNT);
    }

    function test_settleWithPermit_revertsOnAmountExceedsPermitted() public {
        uint256 deadline = block.timestamp + 3600;

        T402BasePermit2Proxy.EIP2612Permit memory permit2612 =
            _signEIP2612Permit(payerKey, payer, address(permit2), MAX_AMOUNT, deadline);

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402UptoPermit2Proxy.AmountExceedsPermitted.selector);
        proxy.settleWithPermit(permit2612, permit, MAX_AMOUNT + 1, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                           FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_settle_partialAmounts(uint256 settleAmount) public {
        settleAmount = bound(settleAmount, 1, MAX_AMOUNT);

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        proxy.settle(permit, settleAmount, payer, witness, sig);

        assertEq(token.balanceOf(recipient), settleAmount);
    }

    function testFuzz_settle_timeWindow(uint256 validAfterOffset) public {
        validAfterOffset = bound(validAfterOffset, 0, 365 days);
        uint256 validAfter = block.timestamp + validAfterOffset;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 365 days + 1
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: validAfter
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        if (block.timestamp < validAfter) {
            vm.prank(facilitator);
            vm.expectRevert(T402BasePermit2Proxy.PaymentTooEarly.selector);
            proxy.settle(permit, SETTLE_AMOUNT, payer, witness, sig);
        } else {
            vm.prank(facilitator);
            proxy.settle(permit, SETTLE_AMOUNT, payer, witness, sig);
            assertEq(token.balanceOf(recipient), SETTLE_AMOUNT);
        }
    }

    /*//////////////////////////////////////////////////////////////
                     INVARIANT: PROXY NEVER HOLDS TOKENS
    //////////////////////////////////////////////////////////////*/

    function test_proxyNeverHoldsTokens() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: MAX_AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        proxy.settle(permit, SETTLE_AMOUNT, payer, witness, sig);

        assertEq(token.balanceOf(address(proxy)), 0, "proxy should never hold tokens");
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _signPermitWitnessTransfer(
        uint256 signerKey,
        IPermit2.PermitTransferFrom memory permit,
        address spender,
        T402BasePermit2Proxy.Witness memory witness
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("Permit2"),
                block.chainid,
                address(permit2)
            )
        );

        bytes32 witnessHash = keccak256(
            abi.encode(
                proxy.WITNESS_TYPEHASH(), witness.to, witness.facilitator, witness.validAfter
            )
        );

        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(
                keccak256("TokenPermissions(address token,uint256 amount)"),
                permit.permitted.token,
                permit.permitted.amount
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)"
                ),
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

    function _signEIP2612Permit(
        uint256 signerKey,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (T402BasePermit2Proxy.EIP2612Permit memory) {
        bytes32 domainSeparator = token.DOMAIN_SEPARATOR();
        uint256 nonce = token.nonces(owner);

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner,
                spender,
                value,
                nonce,
                deadline
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);

        return
            T402BasePermit2Proxy.EIP2612Permit({
                value: value, deadline: deadline, v: v, r: r, s: s
            });
    }
}
