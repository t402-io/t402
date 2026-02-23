// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { T402ExactPermit2Proxy } from "../src/T402ExactPermit2Proxy.sol";
import { T402BasePermit2Proxy, IPermit2 } from "../src/T402BasePermit2Proxy.sol";
import { MockPermit2 } from "./mocks/MockPermit2.sol";
import { MockERC20Permit } from "./mocks/MockERC20Permit.sol";

contract T402ExactPermit2ProxyTest is Test {
    T402ExactPermit2Proxy public proxy;
    MockPermit2 public permit2;
    MockERC20Permit public token;

    address public facilitator;
    uint256 public facilitatorKey;
    address public payer;
    uint256 public payerKey;
    address public recipient;

    uint256 constant AMOUNT = 1000e6; // 1000 USDT (6 decimals)

    function setUp() public {
        // Create accounts
        (facilitator, facilitatorKey) = makeAddrAndKey("facilitator");
        (payer, payerKey) = makeAddrAndKey("payer");
        recipient = makeAddr("recipient");

        // Deploy contracts
        permit2 = new MockPermit2();
        proxy = new T402ExactPermit2Proxy(address(permit2));
        token = new MockERC20Permit("USDT0", "USDT0", 6);

        // Fund payer and approve Permit2
        token.mint(payer, 10_000e6);
        vm.prank(payer);
        token.approve(address(permit2), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_constructor_setsPermit2() public view {
        assertEq(address(proxy.PERMIT2()), address(permit2));
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(T402BasePermit2Proxy.InvalidPermit2Address.selector);
        new T402ExactPermit2Proxy(address(0));
    }

    function test_witnessTypehash() public view {
        bytes32 expected = keccak256("Witness(address to,address facilitator,uint256 validAfter)");
        assertEq(proxy.WITNESS_TYPEHASH(), expected);
    }

    /*//////////////////////////////////////////////////////////////
                            SETTLE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_settle_success() public {
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 3600;
        uint256 validAfter = block.timestamp;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: validAfter
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        uint256 payerBefore = token.balanceOf(payer);
        uint256 recipientBefore = token.balanceOf(recipient);

        vm.prank(facilitator);
        proxy.settle(permit, payer, witness, sig);

        assertEq(token.balanceOf(payer), payerBefore - AMOUNT);
        assertEq(token.balanceOf(recipient), recipientBefore + AMOUNT);
    }

    function test_settle_emitsEvent() public {
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.expectEmit(true, true, true, true);
        emit T402BasePermit2Proxy.Settled(address(token), payer, recipient, AMOUNT, facilitator);

        vm.prank(facilitator);
        proxy.settle(permit, payer, witness, sig);
    }

    function test_settle_revertsOnUnauthorizedFacilitator() public {
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        address notFacilitator = makeAddr("attacker");
        vm.prank(notFacilitator);
        vm.expectRevert(T402BasePermit2Proxy.UnauthorizedFacilitator.selector);
        proxy.settle(permit, payer, witness, sig);
    }

    function test_settle_revertsOnZeroAmount() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: 0 }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402BasePermit2Proxy.InvalidAmount.selector);
        proxy.settle(permit, payer, witness, sig);
    }

    function test_settle_revertsOnZeroOwner() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402BasePermit2Proxy.InvalidOwner.selector);
        proxy.settle(permit, address(0), witness, sig);
    }

    function test_settle_revertsOnZeroDestination() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: address(0), facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402BasePermit2Proxy.InvalidDestination.selector);
        proxy.settle(permit, payer, witness, sig);
    }

    function test_settle_revertsOnPaymentTooEarly() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 7200
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient,
            facilitator: facilitator,
            validAfter: block.timestamp + 3600 // 1 hour in the future
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402BasePermit2Proxy.PaymentTooEarly.selector);
        proxy.settle(permit, payer, witness, sig);
    }

    function test_settle_revertsOnNonceReplay() public {
        uint256 nonce = 42;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        // First settle succeeds
        vm.prank(facilitator);
        proxy.settle(permit, payer, witness, sig);

        // Second settle with same nonce reverts
        vm.prank(facilitator);
        vm.expectRevert(MockPermit2.InvalidNonce.selector);
        proxy.settle(permit, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                      SETTLE WITH PERMIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_settleWithPermit_success() public {
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 3600;

        // Create a fresh payer without Permit2 approval
        (address freshPayer, uint256 freshPayerKey) = makeAddrAndKey("freshPayer");
        token.mint(freshPayer, 10_000e6);
        // No approval to Permit2!

        // Sign EIP-2612 permit to approve Permit2
        T402BasePermit2Proxy.EIP2612Permit memory permit2612 =
            _signEIP2612Permit(freshPayerKey, freshPayer, address(permit2), AMOUNT, deadline);

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(freshPayerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        proxy.settleWithPermit(permit2612, permit, freshPayer, witness, sig);

        assertEq(token.balanceOf(freshPayer), 10_000e6 - AMOUNT);
        assertEq(token.balanceOf(recipient), AMOUNT);
    }

    function test_settleWithPermit_revertsOnAmountMismatch() public {
        uint256 deadline = block.timestamp + 3600;

        T402BasePermit2Proxy.EIP2612Permit memory permit2612 = _signEIP2612Permit(
            payerKey,
            payer,
            address(permit2),
            AMOUNT + 1,
            deadline // mismatched amount
        );

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: AMOUNT }),
            nonce: 0,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402BasePermit2Proxy.Permit2612AmountMismatch.selector);
        proxy.settleWithPermit(permit2612, permit, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                          FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_settle_variousAmounts(uint256 amount) public {
        amount = bound(amount, 1, 10_000e6);

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: address(token), amount: amount }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(proxy), witness);

        vm.prank(facilitator);
        proxy.settle(permit, payer, witness, sig);

        assertEq(token.balanceOf(recipient), amount);
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
